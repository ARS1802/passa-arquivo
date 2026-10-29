import { Directory, type DirectoryBoundaries } from "./Directory.js";
import { File, modelError, type EntryMetadata, type FileContent } from "./File.js";
import path from "node:path";

// Uma seleção por processo. Operações já iniciadas conservam a referência à raiz anterior.
let sharedDirectory: Directory | undefined;
let selectedPaths: (DirectoryBoundaries & { rootPath: string }) | undefined;

/** Seleciona uma raiz após validá-la; em caso de erro, preserva a seleção anterior.
 * A seleção vive em memória e não cria um arquivo de configuração.
 * @param rootPath Caminho absoluto escolhido pela pessoa usuária.
 * @param boundaries Localizações privadas que não podem ser compartilhadas.
 */
export async function setSharedDirectory(rootPath: string, boundaries: DirectoryBoundaries): Promise<void> {
  sharedDirectory = await Directory.open(rootPath, boundaries);
  selectedPaths = { ...boundaries, rootPath };
}

/** Recupera a raiz selecionada ou informa que a configuração ainda não foi feita. */
function selectedDirectory(): Directory {
  if (!sharedDirectory) throw modelError("configuration_required", "Selecione a pasta compartilhada antes da operação.");
  return sharedDirectory;
}

/** Consulta os metadados atuais de uma entrada.
 * @param path Caminho relativo à raiz selecionada.
 */
export async function metadata(path: string): Promise<EntryMetadata> {
  return (await selectedDirectory().entry(path)).metadata();
}

/** Lista apenas os filhos imediatos de uma pasta.
 * @param path Caminho relativo; ponto seleciona a raiz.
 */
export async function list(path = "."): Promise<{ path: string; entries: EntryMetadata[] }> {
  const directory = await selectedDirectory().entry(path);
  if (!(directory instanceof Directory)) throw modelError("entry_conflict", "A listagem exige uma pasta.");
  const entries: EntryMetadata[] = [];
  for (const entry of await directory.list()) entries.push(await entry.metadata());
  return { path, entries };
}

/** Abre o conteúdo de um arquivo para leitura por partes, sem realizar transferência de rede.
 * @param path Caminho relativo de um arquivo regular.
 */
export async function read(path: string) {
  const file = await selectedDirectory().entry(path);
  if (!(file instanceof File)) throw modelError("entry_conflict", "A leitura exige um arquivo regular.");
  return file.read();
}

/** Cria uma pasta e seus pais; uma pasta existente mantém seu conteúdo.
 * @param path Caminho relativo do destino.
 */
export async function createDirectory(path: string): Promise<{ entry: EntryMetadata; created: boolean }> {
  const result = await selectedDirectory().create(path);
  return { entry: await result.directory.metadata(), created: result.created };
}

/** Exclui uma entrada e seu conteúdo, respeitando as proteções da raiz.
 * @param path Caminho relativo da entrada a excluir.
 */
export async function remove(path: string): Promise<void> {
  await (await selectedDirectory().entry(path)).remove();
}

/** Prepara staging por meio de Directory, sem acesso direto ao disco pelo serviço.
 * @param paths Configuração capturada no início da operação.
 */
async function prepareStaging(paths: DirectoryBoundaries & { rootPath: string }): Promise<Directory> {
  return Directory.openPrivate(paths.stagingDir, [paths.rootPath, paths.stateDir, paths.repositoryDir]);
}

/** Grava conteúdo local/recebido por partes, substituindo somente arquivos regulares.
 * @param targetPath Caminho final relativo, com pai existente.
 * @param content Bytes fornecidos pelo controller após a validação do transporte.
 * @param maxBytes Limite de bytes, aplicado durante a leitura.
 */
export async function write(targetPath: string, content: FileContent, maxBytes = 1_073_741_824): Promise<{ entry: EntryMetadata; created: boolean }> {
  const root = selectedDirectory();
  const paths = selectedPaths!;
  const file = root.file(targetPath);
  const result = await file.write(content, await prepareStaging(paths), true, maxBytes);
  return { entry: await file.metadata(), created: result.created };
}

/** Move e/ou renomeia uma entrada, mantendo os campos omitidos.
 * @param sourcePath Caminho atual relativo à raiz.
 * @param changes Nome e/ou pasta pai; overwrite autoriza somente substituição de arquivo.
 */
export async function move(sourcePath: string, changes: { name?: string; parentPath?: string; overwrite?: boolean }): Promise<EntryMetadata> {
  const root = selectedDirectory();
  if (!changes || typeof changes !== "object" || Array.isArray(changes)
    || Object.keys(changes).some(key => !["name", "parentPath", "overwrite"].includes(key))
    || (changes.name === undefined && changes.parentPath === undefined)
    || (changes.overwrite !== undefined && typeof changes.overwrite !== "boolean")) {
    throw modelError("validation_failed", "Informe name e/ou parentPath, com overwrite booleano quando necessário.");
  }
  const name = changes.name ?? path.posix.basename(sourcePath);
  if (typeof name !== "string" || !name || name === "." || name === ".." || /[\\/\0]/.test(name) || changes.name === null) {
    throw modelError("validation_failed", "O novo nome precisa ser um único componente válido.");
  }
  const parentPath = changes.parentPath === undefined ? path.posix.dirname(sourcePath) : changes.parentPath;
  const parent = await root.entry(parentPath);
  if (!(parent instanceof Directory)) throw modelError("entry_conflict", "O pai de destino precisa ser uma pasta.");
  const source = await root.entry(sourcePath);
  return (await source.move(parentPath === "." ? name : `${parentPath}/${name}`, changes.overwrite ?? false)).metadata();
}

/** Copia um arquivo ou árvore para um destino completo, sem criar pais nem mesclar pastas.
 * @param sourcePath Origem relativa à raiz.
 * @param targetPath Destino final completo relativo à raiz.
 * @param overwrite Autoriza somente substituir arquivo regular por arquivo regular.
 */
export async function copy(sourcePath: string, targetPath: string, overwrite = false): Promise<{ entry: EntryMetadata; created: boolean }> {
  const root = selectedDirectory();
  const paths = selectedPaths!;
  if (typeof overwrite !== "boolean") throw modelError("validation_failed", "overwrite precisa ser booleano.");
  const source = await root.entry(sourcePath);
  const staging = await prepareStaging(paths);
  let created = true;
  if (source instanceof Directory) await source.copy(targetPath, staging);
  else created = (await source.copy(root.file(targetPath), staging, overwrite)).created;
  return { entry: await (await root.entry(targetPath)).metadata(), created };
}

/** Abre um ZIP da pasta, sem HTTP e sem salvá-lo como resultado permanente.
 * @param path Caminho relativo da pasta; ponto seleciona a raiz.
 * @param maxEntries Limite de entradas descendentes.
 * @param maxBytes Limite de bytes antes da compressão.
 */
export async function archive(path = ".", maxEntries = 10_000, maxBytes = 10_737_418_240) {
  const directory = await selectedDirectory().entry(path);
  if (!(directory instanceof Directory)) throw modelError("entry_conflict", "O ZIP exige uma pasta.");
  return directory.archive(maxEntries, maxBytes);
}
