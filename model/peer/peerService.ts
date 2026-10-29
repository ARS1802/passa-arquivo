import forge from "node-forge";
import { createPrivateKey, randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { isIP } from "node:net";
import { Directory } from "../file/Directory.js";
import { File, errorCode, modelError } from "../file/File.js";

/** Registro persistido de um peer. IP e apelido não são provas de identidade. */
export interface Peer {
  directory: string;
  displayName: string;
  ipAddress: string;
  firstConnectedAt: string;
  lastConnectedAt: string;
  certificatePem: string;
}

/** Caminhos absolutos fornecidos pela inicialização local, sem valores implícitos. */
export interface PeerStorageOptions {
  stateDir: string;
  rootDir: string;
  stagingDir: string;
  repositoryDir: string;
}

const columns = ["directory", "displayName", "ipAddress", "firstConnectedAt", "lastConnectedAt"] as const;
// Armazenamento e fila pertencem à única instância do processo. Não sincronizam outros processos.
let storage: Directory | undefined;
let pending: Promise<void> = Promise.resolve();

/** Serializa operações para evitar perda de atualizações no CSV.
 * @param operation Operação que será executada depois da anterior.
 */
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  // A fila continua utilizável após falhas; o erro original permanece no resultado retornado.
  pending = result.then(() => undefined, () => undefined);
  return result;
}

/** Obtém a área privada já inicializada. */
function state(): Directory {
  if (!storage) throw modelError("configuration_required", "Inicialize o armazenamento de peers antes da operação.");
  return storage;
}

/** Lê um arquivo privado por meio de sua representação encapsulada.
 * @param file Arquivo a ler.
 */
async function readText(file: File): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of await file.read()) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Interpreta exatamente um certificado público PEM, sem aceitar chaves ou cadeias.
 * @param pem Certificado que identifica o peer.
 * @param requireCurrent Exige validade temporal para estabelecer ou usar confiança.
 */
function certificate(pem: string, requireCurrent = false): X509Certificate {
  if (typeof pem !== "string" || !/^\s*-----BEGIN CERTIFICATE-----[\r\n]+[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(pem)) {
    throw modelError("invalid_certificate", "Informe exatamente um certificado público PEM.");
  }
  let parsed: X509Certificate;
  try { parsed = new X509Certificate(pem); }
  catch { throw modelError("invalid_certificate", "O certificado não pôde ser interpretado."); }
  const now = Date.now();
  if (requireCurrent && (now < Date.parse(parsed.validFrom) || now > Date.parse(parsed.validTo))) {
    throw modelError("invalid_certificate", "O certificado está fora de seu período de validade.");
  }
  return parsed;
}

/** Confere dados de exibição e localização sem usá-los como identidade.
 * @param displayName Apelido textual, preservado sem trim.
 * @param ipAddress Último IP obtido de uma conexão autenticada.
 */
function validatePeerData(displayName: string, ipAddress: string): void {
  if (typeof displayName !== "string" || !displayName.isWellFormed() || displayName.includes("\0")) {
    throw modelError("validation_failed", "Informe um apelido textual válido.");
  }
  if (typeof ipAddress !== "string" || !isIP(ipAddress) || ipAddress.includes("%")) {
    throw modelError("validation_failed", "Informe um endereço IP válido.");
  }
}

/** Codifica o índice CSV com cabeçalho fixo, aspas escapadas e finais de linha CRLF.
 * @param peers Registros que serão persistidos.
 */
function encodeIndex(peers: readonly Peer[]): string {
  return [columns, ...peers.map(peer => columns.map(column => peer[column]))]
    .map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n";
}

/** Lê CSV incluindo vírgulas, aspas e quebras de linha dentro de campos entre aspas.
 * @param source Conteúdo UTF-8 do índice; sintaxe inválida não é descartada silenciosamente.
 */
function parseIndex(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { field += '"'; index++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(field); field = ""; closed = false;
      if (char !== ",") {
        if (char === "\r" && source[index + 1] === "\n") index++;
        rows.push(row); row = [];
      }
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else {
      if (closed || char === '"') throw modelError("peer_store_invalid", "O índice CSV tem sintaxe inválida.");
      field += char;
    }
  }
  if (quoted) throw modelError("peer_store_invalid", "O índice CSV contém um campo incompleto.");
  if (field !== "" || row.length > 0 || closed) { row.push(field); rows.push(row); }
  return rows;
}

/** Lê e confere o índice, os certificados e a correspondência entre linhas e pastas.
 * @param directory Raiz privada do estado local.
 */
async function loadPeers(directory: Directory): Promise<Peer[]> {
  const rows = parseIndex(await readText(directory.file("peers/index.csv")));
  if (rows[0]?.join(",") !== columns.join(",") || rows.length > 100) {
    throw modelError("peer_store_invalid", "O índice de peers tem cabeçalho ou quantidade de registros inválidos.");
  }
  const peers: Peer[] = [];
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row.length !== columns.length) throw modelError("peer_store_invalid", "Uma linha do índice tem campos incompatíveis.");
    const [id, displayName, ipAddress, firstConnectedAt, lastConnectedAt] = row as [string, string, string, string, string];
    if (!/^(0[1-9]|[1-9][0-9])$/.test(id) || ids.has(id)) throw modelError("peer_store_invalid", "O índice contém uma pasta inválida ou repetida.");
    for (const value of [firstConnectedAt, lastConnectedAt]) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw modelError("peer_store_invalid", "O índice contém uma data inválida.");
    }
    validatePeerData(displayName, ipAddress);
    const folder = await directory.entry(`peers/${id}`);
    if (!(folder instanceof Directory)) throw modelError("peer_store_invalid", "O registro precisa estar em uma pasta.");
    const files = await folder.list();
    if (files.length !== 1 || !(files[0] instanceof File) || files[0].path !== `peers/${id}/certificado.cert`) {
      throw modelError("peer_store_invalid", "Uma pasta de peer contém dados inesperados.");
    }
    const certificatePem = await readText(files[0]);
    const fingerprint = certificate(certificatePem).fingerprint256;
    if (identities.has(fingerprint)) throw modelError("peer_store_invalid", "O índice repete a identidade de um peer.");
    ids.add(id); identities.add(fingerprint);
    peers.push({ directory: id, displayName, ipAddress, firstConnectedAt, lastConnectedAt, certificatePem });
  }
  const folder = await directory.entry("peers");
  if (!(folder instanceof Directory)) throw modelError("peer_store_invalid", "A área de peers precisa ser uma pasta.");
  const children = await folder.list();
  if (children.length !== peers.length + 1 || children.some(child => child.path !== "peers/index.csv" && !ids.has(child.path.slice(6)))) {
    throw modelError("peer_store_invalid", "Há registros sem correspondência entre o índice e as pastas.");
  }
  return peers;
}

/** Publica um novo índice sem truncar a versão anterior durante a preparação.
 * @param directory Raiz privada do estado local.
 * @param peers Registros completos a gravar.
 */
async function saveIndex(directory: Directory, peers: readonly Peer[]): Promise<void> {
  await directory.file("peers/index.csv").write(encodeIndex(peers), directory, true);
}

/** Carrega a identidade persistente e confere validade, assinatura e correspondência da chave.
 * @param directory Raiz privada do estado local.
 */
async function readIdentity(directory: Directory): Promise<{ certificatePem: string; privateKeyPem: string }> {
  const certificatePem = await readText(directory.file("tls/server.crt"));
  const privateKeyPem = await readText(directory.file("tls/server.key"));
  const parsed = certificate(certificatePem, true);
  try {
    if (!parsed.checkPrivateKey(createPrivateKey(privateKeyPem)) || !parsed.verify(parsed.publicKey)) {
      throw new Error("Identidade incompatível.");
    }
  } catch { throw modelError("invalid_identity", "O certificado e a chave local não formam uma identidade válida."); }
  return { certificatePem, privateKeyPem };
}

/** Gera a identidade com node-forge e publica certificado e chave juntos em tls.
 * @param directory Raiz privada do estado; tls ainda não pode existir.
 */
async function generateIdentity(directory: Directory): Promise<void> {
  const keys = await new Promise<forge.pki.rsa.KeyPair>((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 }, (error, pair) => error ? reject(error) : resolve(pair));
  });
  const local = forge.pki.createCertificate();
  local.publicKey = keys.publicKey;
  local.serialNumber = `01${randomBytes(19).toString("hex")}`;
  local.validity.notBefore = new Date();
  local.validity.notAfter = new Date(local.validity.notBefore.getTime() + 365 * 24 * 60 * 60 * 1000);
  const name = `passa-arquivo-${randomUUID()}`;
  const subject = [{ name: "commonName", value: name }];
  local.setSubject(subject); local.setIssuer(subject);
  local.setExtensions([
    { name: "basicConstraints", critical: true, cA: false },
    { name: "keyUsage", critical: true, digitalSignature: true, keyEncipherment: true },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames: [{ type: 2, value: name }] },
    { name: "subjectKeyIdentifier" },
  ]);
  local.sign(keys.privateKey, forge.md.sha256.create());
  const temporary = await directory.temporary();
  let published = false;
  try {
    await directory.file(`${temporary.path}/server.crt`).write(forge.pki.certificateToPem(local), directory);
    await directory.file(`${temporary.path}/server.key`).write(forge.pki.privateKeyToPem(keys.privateKey), directory);
    await temporary.move("tls");
    published = true;
  } finally { if (!published) await temporary.remove(); }
}

/** Prepara a identidade e o índice; reinícios nunca regeneram uma identidade existente.
 * Falta de certificado/chave em uma pasta tls existente é erro, não primeira execução.
 * @param options Caminhos privados e compartilhados fornecidos pela inicialização local.
 * @returns Somente o certificado público; a chave permanece no armazenamento privado.
 */
export function initialize(options: PeerStorageOptions): Promise<{ certificatePem: string }> {
  return serialized(async () => {
    const directory = await Directory.openPrivate(options.stateDir, [options.rootDir, options.stagingDir, options.repositoryDir]);
    let exists = true;
    try { await directory.inspect("tls", "directory"); }
    catch (error) { if (errorCode(error) !== "entry_not_found") throw error; exists = false; }
    if (!exists) {
      if ((await directory.list()).length !== 0) {
        throw modelError("invalid_identity", "A identidade local está ausente em um armazenamento já utilizado.");
      }
      await generateIdentity(directory);
    }
    const identity = await readIdentity(directory);
    const peers = await directory.create("peers");
    try { await directory.inspect("peers/index.csv", "file"); }
    catch (error) {
      if (errorCode(error) !== "entry_not_found") throw error;
      if ((await peers.directory.list()).length !== 0) throw modelError("peer_store_invalid", "O índice está ausente e há dados de peers existentes.");
      await directory.file("peers/index.csv").write(encodeIndex([]), directory);
    }
    await loadPeers(directory);
    storage = directory;
    return { certificatePem: identity.certificatePem };
  });
}

/** Lê a identidade para uso local pelo transporte; nunca encaminhar a chave à GUI ou a peers. */
export function localIdentity(): Promise<{ certificatePem: string; privateKeyPem: string }> {
  return serialized(() => readIdentity(state()));
}

/** Lista registros persistidos; essa consulta não autentica nem atualiza conexões. */
export function listPeers(): Promise<Peer[]> {
  return serialized(() => loadPeers(state()));
}

/** Localiza um peer pelo certificado, independentemente de IP e apelido.
 * @param certificatePem Certificado público procurado.
 */
export function findPeer(certificatePem: string): Promise<Peer | undefined> {
  return serialized(async () => {
    const identity = certificate(certificatePem).fingerprint256;
    return (await loadPeers(state())).find(peer => certificate(peer.certificatePem).fingerprint256 === identity);
  });
}

/** Salva confiança após o controller concluir o pareamento bilateral e a prova de posse.
 * Esta função não executa nem substitui pareamento, descoberta ou autenticação de rede.
 * @param input Certificado, apelido e IP obtidos do pareamento confirmado.
 */
export function savePeer(input: Pick<Peer, "certificatePem" | "displayName" | "ipAddress">): Promise<Peer> {
  return serialized(async () => {
    validatePeerData(input.displayName, input.ipAddress);
    const identity = certificate(input.certificatePem, true).fingerprint256;
    const directory = state();
    const peers = await loadPeers(directory);
    const existing = peers.find(peer => certificate(peer.certificatePem).fingerprint256 === identity);
    const now = new Date().toISOString();
    if (existing) {
      existing.displayName = input.displayName; existing.ipAddress = input.ipAddress; existing.lastConnectedAt = now;
      await saveIndex(directory, peers);
      return existing;
    }
    const id = Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, "0"))
      .find(candidate => !peers.some(peer => peer.directory === candidate));
    if (!id) throw modelError("peer_limit_reached", "As 99 posições de peers estão ocupadas.");
    const peer: Peer = { ...input, directory: id, firstConnectedAt: now, lastConnectedAt: now };
    const temporary = await directory.temporary();
    let target: Directory | undefined;
    try {
      await directory.file(`${temporary.path}/certificado.cert`).write(input.certificatePem, directory);
      const moved = await temporary.move(`peers/${id}`);
      if (!(moved instanceof Directory)) throw modelError("peer_store_invalid", "O registro não é uma pasta.");
      target = moved;
      peers.push(peer);
      await saveIndex(directory, peers);
    } catch (error) {
      // O índice já publicado não deve perder o certificado por uma falha posterior de limpeza.
      if (target && errorCode(error) === "publication_cleanup_failed") throw error;
      try { await (target ?? temporary).remove(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "Falha ao salvar e limpar o registro de peer."); }
      throw error;
    }
    return peer;
  });
}

/** Atualiza o apelido sem alterar os horários ou a identidade.
 * @param certificatePem Certificado do peer conhecido.
 * @param displayName Novo apelido local.
 */
export function updatePeer(certificatePem: string, displayName: string): Promise<Peer> {
  return serialized(async () => {
    const identity = certificate(certificatePem).fingerprint256;
    const peers = await loadPeers(state());
    const peer = peers.find(item => certificate(item.certificatePem).fingerprint256 === identity);
    if (!peer) throw modelError("peer_not_found", "O peer não está cadastrado.");
    validatePeerData(displayName, peer.ipAddress);
    peer.displayName = displayName;
    await saveIndex(state(), peers);
    return peer;
  });
}

/** Registra nova conexão somente depois da autenticação mTLS confirmada pelo controller.
 * @param certificatePem Certificado cuja identidade e posse da chave foram verificadas.
 * @param ipAddress Endereço observado nessa conexão, usado apenas como localização.
 */
export function recordConnection(certificatePem: string, ipAddress: string): Promise<Peer> {
  return serialized(async () => {
    const identity = certificate(certificatePem, true).fingerprint256;
    const peers = await loadPeers(state());
    const peer = peers.find(item => certificate(item.certificatePem).fingerprint256 === identity);
    if (!peer) throw modelError("peer_not_found", "O peer não está cadastrado.");
    validatePeerData(peer.displayName, ipAddress);
    peer.ipAddress = ipAddress; peer.lastConnectedAt = new Date().toISOString();
    await saveIndex(state(), peers);
    return peer;
  });
}

/** Remove a confiança local; não altera registros ou sessões em outro dispositivo.
 * @param certificatePem Certificado do peer a remover.
 */
export function removePeer(certificatePem: string): Promise<void> {
  return serialized(async () => {
    const identity = certificate(certificatePem).fingerprint256;
    const directory = state();
    const peers = await loadPeers(directory);
    const peer = peers.find(item => certificate(item.certificatePem).fingerprint256 === identity);
    if (!peer) throw modelError("peer_not_found", "O peer não está cadastrado.");
    const temporary = await directory.temporary();
    const source = await directory.entry(`peers/${peer.directory}`);
    const moved = await source.move(`${temporary.path}/record`);
    try { await saveIndex(directory, peers.filter(item => item !== peer)); }
    catch (error) {
      if (errorCode(error) === "publication_cleanup_failed") {
        try { await temporary.remove(); }
        catch (cleanupError) { throw new AggregateError([error, cleanupError], "Falha ao limpar os dados do peer removido."); }
        throw error;
      }
      try { await moved.move(`peers/${peer.directory}`); await temporary.remove(); }
      catch (rollbackError) { throw new AggregateError([error, rollbackError], "Falha ao remover peer e restaurar seu registro."); }
      throw error;
    }
    await temporary.remove();
  });
}
