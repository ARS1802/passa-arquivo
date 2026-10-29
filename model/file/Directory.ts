import { type Stats } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, realpath, rename, rmdir } from "node:fs/promises";
import { isUtf8 } from "node:buffer";
import { Readable } from "node:stream";
import { ZipFile } from "yazl";
import path from "node:path";
import { File, errorCode, modelError, type EntryMetadata } from "./File.js";

/** Locais privados que precisam permanecer separados da pasta compartilhada. */
export interface DirectoryBoundaries {
  stateDir: string;
  stagingDir: string;
  repositoryDir: string;
}

/** Confere contenção por componentes, inclusive a igualdade.
 * @param parent Caminho absoluto do possível ancestral.
 * @param candidate Caminho absoluto a comparar.
 */
export function containsPath(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

/** Resolve a parte existente de uma configuração, permitindo diretórios privados ainda ausentes.
 * @param value Caminho absoluto nativo, sem expansão de variáveis.
 */
export async function configuredPath(value: string): Promise<string> {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) {
    throw modelError("invalid_path", "A configuração exige um caminho absoluto válido.");
  }
  try { return await realpath(value); }
  catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
    // Um link quebrado não pode ser tratado como uma pasta nova.
    try {
      await lstat(value);
      throw modelError("entry_forbidden", "A configuração contém um link inválido.");
    } catch (inspectionError) {
      if (errorCode(inspectionError) !== "ENOENT") throw inspectionError;
    }
    const parent = path.dirname(value);
    if (parent === value) throw error;
    return path.join(await configuredPath(parent), path.basename(value));
  }
}

/** Valida o formato de um caminho da aplicação antes de normalizá-lo.
 * @param value Caminho relativo à raiz; a própria raiz é representada por ponto.
 */
export function validatePath(value: string): void {
  if (typeof value !== "string") throw modelError("validation_failed", "Informe um caminho textual.");
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || value.split(/[\\/]/).includes("..")) {
    throw modelError("path_forbidden", "O caminho precisa permanecer dentro da raiz.");
  }
  if (!value || value.includes("\0") || value.includes("\\") || !value.isWellFormed()
    || (value !== "." && value.split("/").some(part => part === "" || part === "."))) {
    throw modelError("invalid_path", "O caminho tem um formato inválido.");
  }
  if (process.platform === "win32" && value !== "." && value.split("/").some(part =>
    /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part)
    || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part))) {
    throw modelError("invalid_path", "O nome não é permitido neste sistema operacional.");
  }
}

/** Encapsula diretórios e a conferência física dos caminhos sob uma raiz.
 * As verificações não isolam alterações simultâneas feitas por outros processos.
 */
export class Directory {
  readonly #rootPath: string;
  readonly #rootStats: Stats;
  readonly #path: string;
  readonly #privateStorage: boolean;

  /** Cria uma referência já associada à raiz conferida por open.
   * @param rootPath Localização real da raiz.
   * @param rootStats Identidade da raiz na abertura.
   * @param relativePath Caminho relativo da pasta representada.
   * @param privateStorage Indica armazenamento privado com permissões restritas.
   */
  private constructor(rootPath: string, rootStats: Stats, relativePath = ".", privateStorage = false) {
    this.#rootPath = rootPath;
    this.#rootStats = rootStats;
    this.#path = relativePath;
    this.#privateStorage = privateStorage;
  }

  /** Abre uma raiz existente e recusa sobreposição com estado, staging e repositório.
   * @param rootPath Caminho absoluto escolhido pelo usuário.
   * @param boundaries Caminhos absolutos das áreas que não podem ser compartilhadas.
   */
  static async open(rootPath: string, boundaries: DirectoryBoundaries): Promise<Directory> {
    const root = await configuredPath(rootPath);
    const stats = await lstat(root);
    if (!stats.isDirectory()) throw modelError("entry_conflict", "A raiz precisa ser uma pasta existente.");
    for (const value of [boundaries.stateDir, boundaries.stagingDir, boundaries.repositoryDir]) {
      const forbidden = await configuredPath(value);
      if (containsPath(root, forbidden) || containsPath(forbidden, root)) {
        throw modelError("path_forbidden", "A pasta compartilhada se sobrepõe a uma área privada.");
      }
    }
    return new Directory(root, stats);
  }

  /** Prepara armazenamento privado no Linux; não modifica permissões de pastas existentes.
   * No Windows, a definição e verificação das ACLs ainda são necessárias.
   * @param rootPath Caminho absoluto da área privada.
   * @param excludedPaths Áreas que não podem conter nem estar contidas neste armazenamento.
   */
  static async openPrivate(rootPath: string, excludedPaths: readonly string[]): Promise<Directory> {
    if (process.platform === "win32") throw modelError("private_storage_unavailable", "A proteção por ACL ainda não foi definida para Windows.");
    const root = await configuredPath(rootPath);
    for (const value of excludedPaths) {
      const excluded = await configuredPath(value);
      if (containsPath(root, excluded) || containsPath(excluded, root)) {
        throw modelError("path_forbidden", "O armazenamento privado se sobrepõe a uma área protegida.");
      }
    }
    await mkdir(root, { recursive: true, mode: 0o700 });
    const stats = await lstat(root);
    if (!stats.isDirectory() || stats.isSymbolicLink() || await realpath(root) !== root
      || (stats.mode & 0o077) !== 0 || (process.getuid && stats.uid !== process.getuid())) {
      throw modelError("entry_forbidden", "O armazenamento privado precisa ser uma pasta acessível somente ao dono.");
    }
    return new Directory(root, stats, ".", true);
  }

  /** Cria uma área temporária exclusiva, somente sob armazenamento privado. */
  async temporary(): Promise<Directory> {
    if (!this.#privateStorage) throw modelError("entry_forbidden", "Temporários exigem armazenamento privado.");
    const { absolutePath } = await this.inspect(this.path, "directory");
    const temporaryPath = await mkdtemp(path.join(absolutePath, ".operation-"));
    const relativePath = path.relative(this.#rootPath, temporaryPath).split(path.sep).join("/");
    return new Directory(this.#rootPath, this.#rootStats, relativePath, true);
  }

  /** Representa um arquivo, inclusive um destino ainda ausente.
   * @param relativePath Caminho completo relativo à raiz deste objeto.
   */
  file(relativePath: string): File {
    validatePath(relativePath);
    if (relativePath === ".") throw modelError("entry_conflict", "A raiz não é um arquivo.");
    return new File(this, relativePath);
  }

  /** Caminho relativo da pasta representada. */
  get path(): string { return this.#path; }

  /** Confere a raiz e cada componente sem seguir links internos.
   * @internal Usado pelos objetos File e Directory; não produz dados para a GUI.
   * @param relativePath Caminho relativo à raiz.
   * @param expected Tipo exigido, quando aplicável.
   */
  async inspect(relativePath: string, expected?: "file" | "directory"): Promise<{ absolutePath: string; stats: Stats }> {
    validatePath(relativePath);
    let absolutePath = this.#rootPath;
    let stats = await lstat(absolutePath);
    if (!stats.isDirectory() || stats.isSymbolicLink() || stats.dev !== this.#rootStats.dev || stats.ino !== this.#rootStats.ino
      || await realpath(absolutePath) !== this.#rootPath) {
      throw modelError("entry_forbidden", "A raiz compartilhada mudou; selecione-a novamente.");
    }
    if (this.#privateStorage && ((stats.mode & 0o077) !== 0 || (process.getuid && stats.uid !== process.getuid()))) {
      throw modelError("entry_forbidden", "As permissões do armazenamento privado mudaram.");
    }
    const parts = relativePath === "." ? [] : relativePath.split("/");
    for (const [index, part] of parts.entries()) {
      absolutePath = path.join(absolutePath, part);
      try { stats = await lstat(absolutePath); }
      catch (error) {
        if (errorCode(error) === "ENOENT") throw modelError("entry_not_found", "A entrada não existe.");
        if (errorCode(error) === "ENOTDIR") throw modelError("entry_conflict", "Um componente não é diretório.");
        throw error;
      }
      if (stats.isSymbolicLink() || (!stats.isFile() && !stats.isDirectory()) || (stats.isFile() && stats.nlink > 1)) {
        throw modelError("entry_forbidden", "Links e entradas especiais não são permitidos.");
      }
      if (stats.dev !== this.#rootStats.dev) throw modelError("cross_device_operation", "A entrada pertence a outro sistema de arquivos.");
      if (this.#privateStorage && ((stats.mode & 0o077) !== 0 || (process.getuid && stats.uid !== process.getuid()))) {
        throw modelError("entry_forbidden", "Uma entrada privada tem permissões incompatíveis.");
      }
      if (index < parts.length - 1 && !stats.isDirectory()) throw modelError("entry_conflict", "Um componente não é diretório.");
      if (await realpath(absolutePath) !== absolutePath) throw modelError("entry_forbidden", "A localização da entrada mudou.");
    }
    if ((expected === "file" && !stats.isFile()) || (expected === "directory" && !stats.isDirectory())) {
      throw modelError("entry_conflict", "O tipo da entrada é incompatível com a operação.");
    }
    return { absolutePath, stats };
  }

  /** Localiza uma entrada e devolve sua representação encapsulada.
   * @param relativePath Caminho relativo à raiz, mesmo quando este objeto representa uma subpasta.
   */
  async entry(relativePath: string): Promise<File | Directory> {
    const { stats } = await this.inspect(relativePath);
    return stats.isDirectory() ? new Directory(this.#rootPath, this.#rootStats, relativePath, this.#privateStorage) : new File(this, relativePath);
  }

  /** Consulta metadados da pasta sem calcular seu tamanho recursivo. */
  async metadata(): Promise<EntryMetadata> {
    const { stats } = await this.inspect(this.path, "directory");
    return { name: this.path.split("/").at(-1)!, path: this.path, type: "directory", size: null, modifiedAt: stats.mtime.toISOString() };
  }

  /** Lista filhos imediatos, com pastas primeiro e nomes ordenados pelos bytes UTF-8.
   * Um link ou entrada especial faz a listagem inteira falhar.
   */
  async list(): Promise<Array<File | Directory>> {
    const { absolutePath } = await this.inspect(this.path, "directory");
    const names = await readdir(absolutePath, { encoding: "buffer" });
    const entries: Array<File | Directory> = [];
    for (const bytes of names) {
      if (!isUtf8(bytes)) throw modelError("entry_forbidden", "Um nome não pode ser representado em UTF-8.");
      const name = bytes.toString("utf8");
      entries.push(await this.entry(this.path === "." ? name : `${this.path}/${name}`));
    }
    return entries.sort((a, b) => Number(b instanceof Directory) - Number(a instanceof Directory)
      || Buffer.compare(Buffer.from(a.path.split("/").at(-1)!), Buffer.from(b.path.split("/").at(-1)!)));
  }

  /** Cria uma pasta e pais ausentes, preservando pastas existentes e seu conteúdo.
   * @param relativePath Caminho completo relativo à raiz.
   * @returns Pasta resultante e indicação de criação do destino final.
   */
  async create(relativePath: string): Promise<{ directory: Directory; created: boolean }> {
    validatePath(relativePath);
    let created = false;
    const parts = relativePath === "." ? [] : relativePath.split("/");
    await this.inspect(".", "directory");
    for (let index = 0; index < parts.length; index++) {
      const current = parts.slice(0, index + 1).join("/");
      try { await this.inspect(current, "directory"); }
      catch (error) {
        if (errorCode(error) !== "entry_not_found") throw error;
        const parent = parts.slice(0, index).join("/") || ".";
        const checked = await this.inspect(parent, "directory");
        try {
          await mkdir(path.join(checked.absolutePath, parts[index]!), this.#privateStorage ? { mode: 0o700 } : {});
          if (index === parts.length - 1) created = true;
        } catch (creationError) {
          if (errorCode(creationError) !== "EEXIST") throw creationError;
        }
        await this.inspect(current, "directory");
      }
    }
    return { directory: new Directory(this.#rootPath, this.#rootStats, relativePath, this.#privateStorage), created };
  }

  /** Move uma entrada sob a mesma raiz, sem fallback de cópia seguido de exclusão.
   * @internal Chamado por File.move e Directory.move.
   * @param sourcePath Origem relativa à raiz.
   * @param targetPath Destino final relativo à mesma raiz.
   * @param overwrite Permite somente substituir arquivo regular por arquivo regular.
   */
  async relocate(sourcePath: string, targetPath: string, overwrite: boolean): Promise<File | Directory> {
    validatePath(targetPath);
    if (typeof overwrite !== "boolean") throw modelError("validation_failed", "overwrite precisa ser booleano.");
    if (sourcePath === ".") throw modelError("entry_forbidden", "A raiz não pode ser movida.");
    const source = await this.inspect(sourcePath);
    if (sourcePath === targetPath) return this.entry(sourcePath);
    if (source.stats.isDirectory() && targetPath.startsWith(`${sourcePath}/`)) {
      throw modelError("validation_failed", "Uma pasta não pode ser movida para dentro de si.");
    }
    try {
      const target = await this.inspect(targetPath);
      if (source.stats.dev === target.stats.dev && source.stats.ino === target.stats.ino) return this.entry(sourcePath);
      if (!overwrite || !source.stats.isFile() || !target.stats.isFile()) {
        throw modelError("entry_conflict", "O destino já existe e não pode ser substituído.");
      }
    } catch (error) {
      if (errorCode(error) !== "entry_not_found") throw error;
    }
    const parent = await this.inspect(path.posix.dirname(targetPath), "directory");
    await this.inspect(sourcePath);
    try { await rename(source.absolutePath, path.join(parent.absolutePath, path.posix.basename(targetPath))); }
    catch (error) {
      if (errorCode(error) === "EXDEV") throw modelError("cross_device_operation", "Não é possível mover entre sistemas de arquivos.");
      throw error;
    }
    return this.entry(targetPath);
  }

  /** Move esta pasta ou altera seu nome; o destino é relativo à raiz.
   * @param targetPath Caminho final completo.
   * @param overwrite Não autoriza substituir ou mesclar diretórios.
   */
  async move(targetPath: string, overwrite = false): Promise<File | Directory> {
    return this.relocate(this.path, targetPath, overwrite);
  }

  /** Copia a árvore inteira em staging antes de publicar; nunca mescla diretórios.
   * @param targetPath Destino final completo sob a mesma raiz.
   * @param staging Área privada no mesmo sistema de arquivos.
   */
  async copy(targetPath: string, staging: Directory): Promise<void> {
    validatePath(targetPath);
    if (this.path === ".") throw modelError("entry_forbidden", "A raiz não pode ser origem de cópia.");
    if (targetPath === this.path || targetPath.startsWith(`${this.path}/`)) {
      throw modelError("validation_failed", "A pasta não pode ser copiada sobre si ou para um descendente.");
    }
    await this.inspect(this.path, "directory");
    await this.inspect(path.posix.dirname(targetPath), "directory");
    try {
      await this.inspect(targetPath);
      throw modelError("entry_conflict", "A cópia de pasta exige um destino ausente.");
    } catch (error) { if (errorCode(error) !== "entry_not_found") throw error; }
    const temporary = await staging.temporary();
    let published = false;
    /** Copia cada entrada por suas operações encapsuladas.
     * @param source Pasta de origem.
     * @param destination Caminho relativo à raiz do staging.
     */
    async function copyChildren(source: Directory, destination: string): Promise<void> {
      for (const entry of await source.list()) {
        const target = `${destination}/${path.posix.basename(entry.path)}`;
        if (entry instanceof Directory) {
          await staging.create(target);
          await copyChildren(entry, target);
        } else await entry.copy(staging.file(target), staging);
      }
    }
    try {
      await copyChildren(this, temporary.path);
      await this.inspect(this.path, "directory");
      try {
        await this.inspect(targetPath);
        throw modelError("entry_conflict", "O destino foi ocupado durante a cópia.");
      } catch (error) { if (errorCode(error) !== "entry_not_found") throw error; }
      const parent = await this.inspect(path.posix.dirname(targetPath), "directory");
      const source = await temporary.inspect(temporary.path, "directory");
      try { await rename(source.absolutePath, path.join(parent.absolutePath, path.posix.basename(targetPath))); }
      catch (error) {
        if (errorCode(error) === "EXDEV") throw modelError("cross_device_operation", "Staging e destino precisam estar no mesmo sistema de arquivos.");
        throw error;
      }
      published = true;
    } finally { if (!published) await temporary.remove(); }
  }

  /** Gera ZIP por partes, sem arquivo permanente e sem incluir a pasta contêiner.
   * @param maxEntries Máximo de arquivos e pastas descendentes, incluindo pastas vazias.
   * @param maxBytes Máximo de bytes lidos antes da compressão.
   * @returns Stream que o consumidor deve concluir ou destruir para cancelar.
   */
  async archive(maxEntries = 10_000, maxBytes = 10_737_418_240): Promise<Readable> {
    if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0 || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw modelError("validation_failed", "Os limites do ZIP precisam ser inteiros positivos.");
    }
    const entries: Array<{ entry: File | Directory; metadata: EntryMetadata }> = [];
    /** Confere entradas antes de iniciar o ZIP, limitando também o catálogo em memória.
     * @param directory Pasta em inspeção.
     */
    async function collect(directory: Directory): Promise<void> {
      for (const entry of await directory.list()) {
        if (entries.length >= maxEntries) throw modelError("payload_too_large", "O ZIP excede o limite de entradas.");
        entries.push({ entry, metadata: await entry.metadata() });
        if (entry instanceof Directory) await collect(entry);
      }
    }
    await collect(this);
    const zip = new ZipFile();
    const output = zip.outputStream as Readable;
    const active = new Set<Readable>();
    let total = 0;
    zip.on("error", (error: Error) => output.destroy(error));
    output.on("close", () => { for (const stream of active) stream.destroy(); });
    for (const { entry, metadata } of entries) {
      const name = this.path === "." ? entry.path : entry.path.slice(this.path.length + 1);
      if (entry instanceof Directory) zip.addEmptyDirectory(name, { mtime: new Date(metadata.modifiedAt) });
      else {
        const file = entry;
        zip.addReadStreamLazy(name, { mtime: new Date(metadata.modifiedAt) }, callback => {
          /** Conta os bytes efetivamente lidos, inclusive se o arquivo mudar após os metadados. */
          async function* chunks(): AsyncGenerator<Buffer> {
            const source = await file.read();
            active.add(source);
            try {
              if (output.destroyed) return;
              for await (const chunk of source) {
                const bytes = Buffer.from(chunk);
                total += bytes.length;
                if (total > maxBytes) throw modelError("payload_too_large", "O ZIP excede o limite de bytes.");
                yield bytes;
              }
            } finally { source.destroy(); active.delete(source); }
          }
          const stream = Readable.from(chunks());
          active.add(stream);
          stream.on("error", (error: Error) => zip.emit("error", error));
          stream.on("close", () => active.delete(stream));
          callback(null, stream);
          if (output.destroyed) stream.destroy();
        });
      }
    }
    zip.end();
    return output;
  }

  /** Exclui a árvore sem seguir nem remover links; a raiz nunca pode ser excluída.
   * Valida a árvore antes de começar. Falhas durante a remoção podem deixar exclusão parcial.
   */
  async remove(): Promise<void> {
    if (this.path === ".") throw modelError("entry_forbidden", "A raiz compartilhada não pode ser excluída.");
    const entries: Array<File | Directory> = [];
    /** Reúne descendentes antes de seus pais para conferir tudo antes da exclusão.
     * @param directory Pasta sendo percorrida.
     */
    async function collect(directory: Directory): Promise<void> {
      for (const entry of await directory.list()) {
        if (entry instanceof Directory) await collect(entry);
        else entries.push(entry);
      }
      entries.push(directory);
    }
    await collect(this);
    for (const entry of entries) {
      if (entry instanceof File) await entry.remove();
      else {
        const { absolutePath } = await entry.inspect(entry.path, "directory");
        await rmdir(absolutePath);
      }
    }
  }
}
