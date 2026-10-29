import { constants, type ReadStream } from "node:fs";
import { link, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import type { Directory } from "./Directory.js";

/** Informações públicas de uma entrada, sempre relativas à raiz compartilhada. */
export interface EntryMetadata {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
  modifiedAt: string;
}

/** Conteúdo local ou recebido por partes; transporte HTTP não pertence ao model. */
export type FileContent = string | Uint8Array | AsyncIterable<Uint8Array>;

/** Cria um erro do model, sem associá-lo a uma resposta HTTP.
 * @param code Código que permite ao controller identificar a falha.
 * @param message Explicação sem caminhos locais ou credenciais.
 */
export function modelError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

/** Obtém o código de um erro operacional sem pressupor seu tipo.
 * @param error Erro recebido de uma operação.
 */
export function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error
    && typeof error.code === "string" ? error.code : undefined;
}

/** Encapsula um arquivo regular. Revalida sua localização antes de acessar o disco. */
export class File {
  readonly #directory: Directory;
  readonly #path: string;

  /** Associa o arquivo ao limite de acesso mantido pelo diretório.
   * @param directory Diretório que conhece a raiz e suas restrições.
   * @param path Caminho relativo à raiz, sem decodificação de URL.
   */
  constructor(directory: Directory, path: string) {
    this.#directory = directory;
    this.#path = path;
  }

  /** Caminho relativo à raiz, sem revelar a localização no computador. */
  get path(): string { return this.#path; }

  /** Consulta os metadados atuais; recusa diretórios e entradas proibidas. */
  async metadata(): Promise<EntryMetadata> {
    const { stats } = await this.#directory.inspect(this.path, "file");
    return {
      name: this.path.split("/").at(-1)!, path: this.path, type: "file",
      size: stats.size, modifiedAt: stats.mtime.toISOString(),
    };
  }

  /** Abre uma leitura por partes; quem consome deve concluir ou destruir o stream.
   * Não impõe bloqueio exclusivo nem promete uma versão fixa durante edições.
   */
  async read(): Promise<ReadStream> {
    const { absolutePath, stats } = await this.#directory.inspect(this.path, "file");
    const handle = await open(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink > 1 || opened.dev !== stats.dev || opened.ino !== stats.ino) {
        throw modelError("entry_forbidden", "O arquivo mudou durante a abertura.");
      }
      return handle.createReadStream({ autoClose: true });
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  /** Remove somente este arquivo regular; ausência e falhas do sistema são propagadas. */
  async remove(): Promise<void> {
    const { absolutePath } = await this.#directory.inspect(this.path, "file");
    await unlink(absolutePath);
  }

  /** Prepara o conteúdo em área privada e só então publica no destino.
   * @param content Bytes ou fonte assíncrona, sem processamento HTTP/multipart.
   * @param staging Área privada no mesmo sistema de arquivos do destino.
   * @param overwrite Autoriza substituir somente arquivo regular.
   * @param maxBytes Limite conferido durante a leitura.
   * @returns Indica se não havia arquivo no destino antes da publicação.
   */
  async write(content: FileContent, staging: Directory, overwrite = false, maxBytes = Number.MAX_SAFE_INTEGER): Promise<{ created: boolean }> {
    if (typeof overwrite !== "boolean" || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw modelError("validation_failed", "Informe sobrescrita e limite de bytes válidos.");
    }
    let existed = false;
    try { await this.#directory.inspect(this.path, "file"); existed = true; }
    catch (error) { if (errorCode(error) !== "entry_not_found") throw error; }
    if (existed && !overwrite) throw modelError("entry_conflict", "O arquivo de destino já existe.");
    await this.#directory.inspect(path.posix.dirname(this.path), "directory");
    const temporary = await staging.temporary();
    const prepared = path.join((await temporary.inspect(temporary.path, "directory")).absolutePath, "content");
    let published = false;
    let operationError: unknown;
    try {
      const handle = await open(prepared, "wx", 0o600);
      try {
        let total = 0;
        const chunks = typeof content === "string" ? [Buffer.from(content)] : content instanceof Uint8Array ? [content] : content;
        for await (const chunk of chunks) {
          if (!(chunk instanceof Uint8Array)) throw modelError("validation_failed", "O conteúdo precisa fornecer bytes.");
          total += chunk.byteLength;
          if (total > maxBytes) throw modelError("payload_too_large", "O conteúdo excede o limite permitido.");
          await handle.writeFile(chunk);
        }
        await handle.sync();
      } finally { await handle.close(); }
      // Revalida o destino depois de consumir a fonte: ela pode ter levado tempo ou falhado.
      existed = false;
      try { await this.#directory.inspect(this.path, "file"); existed = true; }
      catch (error) { if (errorCode(error) !== "entry_not_found") throw error; }
      if (existed && !overwrite) throw modelError("entry_conflict", "O arquivo de destino já existe.");
      const parent = await this.#directory.inspect(path.posix.dirname(this.path), "directory");
      const destination = path.join(parent.absolutePath, path.posix.basename(this.path));
      try {
        if (overwrite) await rename(prepared, destination);
        else await link(prepared, destination);
        published = true;
      } catch (error) {
        if (errorCode(error) === "EEXIST") throw modelError("entry_conflict", "O destino foi ocupado antes da publicação.");
        if (errorCode(error) === "EXDEV") throw modelError("cross_device_operation", "Staging e destino precisam estar no mesmo sistema de arquivos.");
        throw error;
      }
      return { created: !existed };
    } catch (error) {
      operationError = error;
      throw error;
    } finally {
      // Remove somente o temporário criado por esta chamada, inclusive após publicação por link.
      const cleanupErrors: unknown[] = [];
      try { await unlink(prepared); }
      catch (error) { if (errorCode(error) !== "ENOENT") cleanupErrors.push(error); }
      try { await temporary.remove(); }
      catch (error) { cleanupErrors.push(error); }
      if (cleanupErrors.length) {
        throw Object.assign(new AggregateError(operationError === undefined ? cleanupErrors : [operationError, ...cleanupErrors],
          "Falha ao limpar os temporários da operação."), { code: published ? "publication_cleanup_failed" : "operation_cleanup_failed" });
      }
    }
  }

  /** Copia o conteúdo por partes para outro arquivo encapsulado.
   * @param target Destino completo, cujo pai precisa existir.
   * @param staging Área privada de preparação.
   * @param overwrite Autoriza substituir arquivo regular.
   */
  async copy(target: File, staging: Directory, overwrite = false): Promise<{ created: boolean }> {
    const source = await this.#directory.inspect(this.path, "file");
    try {
      const destination = await target.#directory.inspect(target.path, "file");
      if (source.stats.dev === destination.stats.dev && source.stats.ino === destination.stats.ino) {
        throw modelError("validation_failed", "Origem e destino são o mesmo arquivo.");
      }
    } catch (error) { if (errorCode(error) !== "entry_not_found") throw error; }
    const stream = await this.read();
    try { return await target.write(stream, staging, overwrite); }
    finally { stream.destroy(); }
  }

  /** Move ou renomeia o arquivo sob sua raiz.
   * @param targetPath Caminho final completo relativo à raiz.
   * @param overwrite Autoriza substituir outro arquivo regular.
   */
  async move(targetPath: string, overwrite = false): Promise<File | Directory> {
    return this.#directory.relocate(this.path, targetPath, overwrite);
  }
}
