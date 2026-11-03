/**
 * Responsabilidade: Manter a identidade local e os registros privados de peers, distinguindo
 * preparações de confiança confirmada.
 *
 * Exemplo prático: Durante um pareamento, preparePeer grava uma pasta numerada; listPeers só
 * inclui esse peer depois de confirmPeer.
 */
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

/** Estado privado do registro; consultas normais não expõem peers pendentes. */
interface StoredPeer extends Peer {
  pairingId: string;
  status: "pending" | "trusted";
}

const legacyColumns = ["directory", "displayName", "ipAddress", "firstConnectedAt", "lastConnectedAt"] as const;
const columns = [...legacyColumns, "pairingId", "status"] as const;
const peerDirectoryPattern = /^(0[1-9]|[1-9][0-9])$/;
// Armazenamento e fila pertencem à única instância do processo. Não sincronizam outros processos.
let storage: Directory | undefined;
let pending: Promise<void> = Promise.resolve();

/** Serializa operações para evitar perda de atualizações no CSV.
 * @param operation Operação que será executada depois da anterior.
 * @returns Resultado da operação; uma falha não impede as próximas operações da fila.
 */
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  // A fila continua utilizável após falhas; o erro original permanece no resultado retornado.
  pending = result.then(() => undefined, () => undefined);
  return result;
}

/** Obtém a área privada já inicializada.
 * @returns Diretório privado selecionado na inicialização.
 */
function state(): Directory {
  if (!storage) throw modelError("configuration_required", "Inicialize o armazenamento de peers antes da operação.");
  return storage;
}

/** Lê um arquivo privado por meio de sua representação encapsulada.
 * @param file Arquivo a ler.
 * @returns Conteúdo decodificado como UTF-8; bytes inválidos causam erro.
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
 * @returns Certificado interpretado, com validade conferida quando exigida.
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
 * @returns CSV completo com cabeçalho e campos entre aspas.
 */
function encodeIndex(peers: readonly StoredPeer[]): string {
  const rows = [columns, ...peers.map(peer => columns.map(column => peer[column]))];
  const lines = rows.map(row => {
    const quotedFields = row.map(value => `"${value.replaceAll('"', '""')}"`);
    return quotedFields.join(",");
  });
  return lines.join("\r\n") + "\r\n";
}

/** Lê CSV incluindo vírgulas, aspas e quebras de linha dentro de campos entre aspas.
 * @param source Conteúdo UTF-8 do índice; sintaxe inválida não é descartada silenciosamente.
 * @returns Linhas e campos decodificados, sem descartar dados inválidos silenciosamente.
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
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
      continue;
    }
    if (char === "," || char === "\n" || char === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (char !== ",") {
        if (char === "\r" && source[index + 1] === "\n") index++;
        rows.push(row);
        row = [];
      }
      continue;
    }
    if (char === '"' && field === "" && !closed) {
      quoted = true;
      continue;
    }
    if (closed || char === '"') throw modelError("peer_store_invalid", "O índice CSV tem sintaxe inválida.");
    field += char;
  }
  if (quoted) throw modelError("peer_store_invalid", "O índice CSV contém um campo incompleto.");
  if (field !== "" || row.length > 0 || closed) { row.push(field); rows.push(row); }
  return rows;
}

/** Lê e confere o índice, os certificados e a correspondência entre linhas e pastas.
 * @param directory Raiz privada do estado local.
 * @returns Registros internos, incluindo preparações ainda não confiáveis.
 */
async function loadPeers(directory: Directory): Promise<StoredPeer[]> {
  const rows = parseIndex(await readText(directory.file("index.csv")));
  const header = rows[0];
  const legacy = header?.length === legacyColumns.length;
  const expected = legacy ? legacyColumns : columns;
  if (!header || header.length !== expected.length
    || header.some((column, index) => column !== expected[index]) || rows.length > 100) {
    throw modelError("peer_store_invalid", "O índice de peers tem cabeçalho ou quantidade de registros inválidos.");
  }
  const peers: StoredPeer[] = [];
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row.length !== (legacy ? legacyColumns.length : columns.length)) throw modelError("peer_store_invalid", "Uma linha do índice tem campos incompatíveis.");
    const [id, displayName, ipAddress, firstConnectedAt, lastConnectedAt] = row as [string, string, string, string, string];
    const pairingId = legacy ? "" : row[5]!;
    const status = legacy ? "trusted" : row[6]!;
    if (status !== "pending" && status !== "trusted" || status === "pending" && !pairingId) {
      throw modelError("peer_store_invalid", "O índice contém um estado de pareamento inválido.");
    }
    if (pairingId) validatePairingId(pairingId);
    if (!peerDirectoryPattern.test(id) || ids.has(id)) throw modelError("peer_store_invalid", "O índice contém uma pasta inválida ou repetida.");
    for (const value of [firstConnectedAt, lastConnectedAt]) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw modelError("peer_store_invalid", "O índice contém uma data inválida.");
    }
    validatePeerData(displayName, ipAddress);
    const folder = await directory.entry(id);
    if (!(folder instanceof Directory)) throw modelError("peer_store_invalid", "O registro precisa estar em uma pasta.");
    const files = await folder.list();
    if (files.length !== 1 || !(files[0] instanceof File) || files[0].path !== `${id}/certificado.cert`) {
      throw modelError("peer_store_invalid", "Uma pasta de peer contém dados inesperados.");
    }
    const certificatePem = await readText(files[0]);
    const fingerprint = certificate(certificatePem).fingerprint256;
    if (identities.has(fingerprint)) throw modelError("peer_store_invalid", "O índice repete a identidade de um peer.");
    ids.add(id); identities.add(fingerprint);
    peers.push({ directory: id, displayName, ipAddress, firstConnectedAt, lastConnectedAt, certificatePem, pairingId, status });
  }
  const children = (await directory.childNames()).filter(name => peerDirectoryPattern.test(name));
  if (children.length !== peers.length || children.some(name => !ids.has(name))) {
    throw modelError("peer_store_invalid", "Há registros sem correspondência entre o índice e as pastas.");
  }
  return peers;
}

/** Publica um novo índice sem truncar a versão anterior durante a preparação.
 * @param directory Raiz privada do estado local.
 * @param peers Registros completos a gravar.
 */
async function saveIndex(directory: Directory, peers: readonly StoredPeer[]): Promise<void> {
  await directory.file("index.csv").write(encodeIndex(peers), directory, true);
}

/** Carrega a identidade persistente e confere validade, assinatura e correspondência da chave.
 * @param directory Raiz privada do estado local.
 * @returns Certificado público e chave privada para uso exclusivo do transporte local.
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
 * Os registros ficam diretamente em 01 a 99, com index.csv e tls na mesma raiz.
 * Arquivos de código nessa raiz não são registros e não são lidos ou removidos.
 * @param options Caminhos privados e compartilhados fornecidos pela inicialização local.
 * @returns Somente o certificado público; a chave permanece no armazenamento privado.
 */
export function initialize(options: PeerStorageOptions): Promise<{ certificatePem: string }> {
  return serialized(async () => {
    const directory = await Directory.openPrivate(options.stateDir, [options.rootDir, options.stagingDir], options.repositoryDir);
    const names = await directory.childNames();
    if (names.includes("peers")) {
      throw modelError("peer_store_migration_required", "Há armazenamento no formato anterior; migre os registros antes de iniciar.");
    }
    const hasIndex = names.includes("index.csv");
    let exists = true;
    try { await directory.inspect("tls", "directory"); }
    catch (error) { if (errorCode(error) !== "entry_not_found") throw error; exists = false; }
    if (!exists && (hasIndex || names.some(name => name.startsWith(".operation-")))) {
      throw modelError("invalid_identity", "A identidade local está ausente em um armazenamento já utilizado.");
    }
    if (!hasIndex) {
      // Posições vazias do esqueleto não são peers. rmdir nunca apaga conteúdo.
      for (const name of names.filter(name => peerDirectoryPattern.test(name))) {
        try { await directory.removeEmptyChild(name); }
        catch (error) {
          if (errorCode(error) === "ENOTEMPTY" || errorCode(error) === "EEXIST") {
            throw modelError("peer_store_invalid", "Há dados de peers existentes sem um índice.");
          }
          throw error;
        }
      }
    }
    if (!exists) await generateIdentity(directory);
    const identity = await readIdentity(directory);
    if (!hasIndex) await directory.file("index.csv").write(encodeIndex([]), directory);
    let records = await loadPeers(directory);
    // Um reinício não retoma aceites humanos nem promove uma preparação incompleta.
    for (const record of records.filter(peer => peer.status === "pending")) {
      await deleteRecord(directory, records, record);
      records = records.filter(peer => peer !== record);
    }
    storage = directory;
    return { certificatePem: identity.certificatePem };
  });
}

/** Lê a identidade para uso local pelo transporte; nunca encaminhar a chave à GUI ou a peers.
 * @returns Identidade validada; a chave privada não deve sair do transporte local.
 */
export function localIdentity(): Promise<{ certificatePem: string; privateKeyPem: string }> {
  return serialized(() => readIdentity(state()));
}

/** Lista registros persistidos; essa consulta não autentica nem atualiza conexões.
 * @returns Somente peers confiáveis, sem os campos privados de preparação.
 */
export function listPeers(): Promise<Peer[]> {
  return serialized(async () => (await loadPeers(state())).filter(peer => peer.status === "trusted").map(publicPeer));
}

/** Localiza um peer pelo certificado, independentemente de IP e apelido.
 * @param certificatePem Certificado público procurado.
 * @returns Peer confiável correspondente ao certificado, ou undefined.
 */
export function findPeer(certificatePem: string): Promise<Peer | undefined> {
  return serialized(async () => {
    const identity = certificate(certificatePem).fingerprint256;
    const peer = (await loadPeers(state())).find(peer => peer.status === "trusted" && certificate(peer.certificatePem).fingerprint256 === identity);
    return peer ? publicPeer(peer) : undefined;
  });
}

/** Salva confiança após o controller concluir o pareamento bilateral e a prova de posse.
 * Esta função não executa nem substitui pareamento, descoberta ou autenticação de rede.
 * @param input Certificado, apelido e IP obtidos do pareamento confirmado.
 * @returns Registro confiável salvo ou atualizado.
 */
export function savePeer(input: Pick<Peer, "certificatePem" | "displayName" | "ipAddress">): Promise<Peer> {
  return serialized(async () => publicPeer(await storePeer(input, "", "trusted")));
}

/** Confere o identificador da sessão sem aceitar caminhos ou identificadores arbitrários.
 * @param pairingId UUID v4 criado pelo controller.
 */
function validatePairingId(pairingId: string): void {
  if (typeof pairingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pairingId)) {
    throw modelError("validation_failed", "Informe um identificador válido de sessão de pareamento.");
  }
}

/** Retira os campos de preparação das consultas públicas de peers.
 * @param peer Registro privado persistido.
 * @returns Cópia pública sem status ou identificador da preparação.
 */
function publicPeer(peer: StoredPeer): Peer {
  const { pairingId: _pairingId, status: _status, ...result } = peer;
  return result;
}

/** Prepara um registro sem liberar confiança; repetir a mesma sessão é idempotente.
 * @param input Certificado, apelido e IP conferidos pelo controller.
 * @param pairingId Sessão vinculada aos dois certificados e aos aceites locais.
 */
export function preparePeer(input: Pick<Peer, "certificatePem" | "displayName" | "ipAddress">, pairingId: string): Promise<void> {
  return serialized(async () => {
    validatePairingId(pairingId);
    await storePeer(input, pairingId, "pending");
  });
}

/** Confirma somente o registro preparado pela mesma sessão, após a confirmação remota.
 * @param certificatePem Certificado cuja posse e aceite foram verificados pelo controller.
 * @param pairingId Identificador da preparação concluída nos dois dispositivos.
 * @returns Peer confiável após publicar o índice atualizado.
 */
export function confirmPeer(certificatePem: string, pairingId: string): Promise<Peer> {
  return serialized(async () => {
    validatePairingId(pairingId);
    const identity = certificate(certificatePem, true).fingerprint256;
    const peers = await loadPeers(state());
    const peer = peers.find(item => certificate(item.certificatePem).fingerprint256 === identity && item.pairingId === pairingId);
    if (!peer) throw modelError("pairing_not_ready", "Não há preparação desta sessão para confirmar.");
    if (peer.status === "pending") {
      peer.status = "trusted";
      peer.firstConnectedAt = peer.lastConnectedAt = new Date().toISOString();
      await saveIndex(state(), peers);
    }
    return publicPeer(peer);
  });
}

/** Descarta somente uma preparação desta sessão; nunca remove um peer já confiável.
 * @param certificatePem Certificado do pedido abandonado.
 * @param pairingId Identificador da sessão que preparou o registro.
 */
export function discardPreparedPeer(certificatePem: string, pairingId: string): Promise<void> {
  return serialized(async () => {
    validatePairingId(pairingId);
    const identity = certificate(certificatePem).fingerprint256;
    const directory = state();
    const peers = await loadPeers(directory);
    const peer = peers.find(item => item.status === "pending" && item.pairingId === pairingId && certificate(item.certificatePem).fingerprint256 === identity);
    if (peer) await deleteRecord(directory, peers, peer);
  });
}

/** Grava ou reencontra um registro dentro da fila do armazenamento.
 * @param input Dados validados do peer.
 * @param pairingId Sessão de preparação, ou vazio para o contrato legado de savePeer.
 * @param status Estado inicial do novo registro.
 * @returns Registro interno salvo ou reencontrado para a mesma sessão.
 */
async function storePeer(input: Pick<Peer, "certificatePem" | "displayName" | "ipAddress">, pairingId: string, status: StoredPeer["status"]): Promise<StoredPeer> {
  validatePeerData(input.displayName, input.ipAddress);
  const identity = certificate(input.certificatePem, true).fingerprint256;
  const directory = state();
  const peers = await loadPeers(directory);
  const existing = peers.find(peer => certificate(peer.certificatePem).fingerprint256 === identity);
  const now = new Date().toISOString();
  if (existing) {
    if (pairingId || existing.status === "pending") {
      if (existing.pairingId !== pairingId) throw modelError("pairing_conflict", "A identidade já pertence a outro registro ou sessão.");
      return existing;
    }
    existing.displayName = input.displayName; existing.ipAddress = input.ipAddress; existing.lastConnectedAt = now;
    await saveIndex(directory, peers);
    return existing;
  }
  let id: string | undefined;
  for (let index = 0; index < 99; index++) {
    const candidate = String(index + 1).padStart(2, "0");
    if (peers.some(peer => peer.directory === candidate)) continue;
    id = candidate;
    break;
  }
  if (!id) throw modelError("peer_limit_reached", "As 99 posições de peers estão ocupadas.");
  const peer: StoredPeer = { ...input, directory: id, firstConnectedAt: now, lastConnectedAt: now, pairingId, status };
  const temporary = await directory.temporary();
  let target: Directory | undefined;
  try {
    await directory.file(`${temporary.path}/certificado.cert`).write(input.certificatePem, directory);
    const moved = await temporary.move(id);
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
}

/** Atualiza o apelido sem alterar os horários ou a identidade.
 * @param certificatePem Certificado do peer conhecido.
 * @param displayName Novo apelido local.
 * @returns Peer com o novo apelido persistido.
 */
export function updatePeer(certificatePem: string, displayName: string): Promise<Peer> {
  return serialized(async () => {
    const identity = certificate(certificatePem).fingerprint256;
    const peers = await loadPeers(state());
    const peer = peers.find(item => item.status === "trusted" && certificate(item.certificatePem).fingerprint256 === identity);
    if (!peer) throw modelError("peer_not_found", "O peer não está cadastrado.");
    validatePeerData(displayName, peer.ipAddress);
    peer.displayName = displayName;
    await saveIndex(state(), peers);
    return publicPeer(peer);
  });
}

/** Registra nova conexão somente depois da autenticação mTLS confirmada pelo controller.
 * @param certificatePem Certificado cuja identidade e posse da chave foram verificadas.
 * @param ipAddress Endereço observado nessa conexão, usado apenas como localização.
 * @returns Peer com IP e horário da conexão atualizados.
 */
export function recordConnection(certificatePem: string, ipAddress: string): Promise<Peer> {
  return serialized(async () => {
    const identity = certificate(certificatePem, true).fingerprint256;
    const peers = await loadPeers(state());
    const peer = peers.find(item => item.status === "trusted" && certificate(item.certificatePem).fingerprint256 === identity);
    if (!peer) throw modelError("peer_not_found", "O peer não está cadastrado.");
    validatePeerData(peer.displayName, ipAddress);
    peer.ipAddress = ipAddress; peer.lastConnectedAt = new Date().toISOString();
    await saveIndex(state(), peers);
    return publicPeer(peer);
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
    const peer = peers.find(item => item.status === "trusted" && certificate(item.certificatePem).fingerprint256 === identity);
    if (!peer) throw modelError("peer_not_found", "O peer não está cadastrado.");
    await deleteRecord(directory, peers, peer);
  });
}

/** Retira um registro e seu certificado, restaurando a pasta se a publicação do índice falhar.
 * @param directory Armazenamento privado.
 * @param peers Índice carregado dentro da fila serializada.
 * @param peer Registro exato a retirar.
 */
async function deleteRecord(directory: Directory, peers: StoredPeer[], peer: StoredPeer): Promise<void> {
  const temporary = await directory.temporary();
  const source = await directory.entry(peer.directory);
  const moved = await source.move(`${temporary.path}/record`);
  try { await saveIndex(directory, peers.filter(item => item !== peer)); }
  catch (error) {
    if (errorCode(error) === "publication_cleanup_failed") {
      try { await temporary.remove(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "Falha ao limpar os dados do peer removido."); }
      throw error;
    }
    try { await moved.move(peer.directory); await temporary.remove(); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], "Falha ao remover peer e restaurar seu registro."); }
    throw error;
  }
  await temporary.remove();
}
