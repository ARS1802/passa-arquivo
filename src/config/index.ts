import { isIP } from "node:net";
import { posix as path } from "node:path";
import { z } from "zod";

export interface AppConfig {
  readonly root: string;
  readonly host: string;
  readonly port: number;
  readonly stateDir: string;
  readonly stagingDir: string;
  readonly tlsMode: "self-signed" | "provided";
  readonly tlsSans: readonly string[];
  readonly tlsCertFile: string;
  readonly tlsKeyFile: string;
  readonly tokensFile?: string;
  readonly corsOrigins: readonly string[];
  readonly uploadMaxBytes: number;
  readonly zipMaxEntries: number;
  readonly zipMaxBytes: number;
  readonly jsonMaxBytes: number;
  readonly shutdownTimeoutMs: number;
}

export interface ConfigIssue {
  readonly option: string;
  readonly message: string;
}

export class ConfigurationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super("Configuração inválida.");
    this.name = "ConfigurationError";
    this.issues = Object.freeze(
      issues.map((issue) => Object.freeze({ ...issue })),
    );
  }
}

const optionNames = {
  root: "root",
  host: "host",
  port: "port",
  stateDir: "state-dir",
  stagingDir: "staging-dir",
  tlsMode: "tls-mode",
  tlsSans: "tls-sans",
  tlsCertFile: "tls-cert-file",
  tlsKeyFile: "tls-key-file",
  tokensFile: "tokens-file",
  corsOrigins: "cors-origins",
  uploadMaxBytes: "upload-max-bytes",
  zipMaxEntries: "zip-max-entries",
  zipMaxBytes: "zip-max-bytes",
  jsonMaxBytes: "json-max-bytes",
  shutdownTimeoutMs: "shutdown-timeout-ms",
} as const satisfies Record<keyof AppConfig, string>;

type ConfigKey = keyof typeof optionNames;
type RawConfig = Partial<Record<ConfigKey, string>>;

const defaults: RawConfig = {
  host: "127.0.0.1",
  port: "8443",
  tlsMode: "self-signed",
  tlsSans: '["localhost","127.0.0.1"]',
  corsOrigins: "[]",
  uploadMaxBytes: "1073741824",
  zipMaxEntries: "10000",
  zipMaxBytes: "10737418240",
  jsonMaxBytes: "16384",
  shutdownTimeoutMs: "10000",
};

const optionEntries = Object.entries(optionNames) as [ConfigKey, string][];
const cliKeys = new Map(optionEntries.map(([key, name]) => [`--${name}`, key]));
const envKeys = new Set(optionEntries.map(([, name]) => environmentName(name)));

function environmentName(name: string): string {
  return `PASSA_${name.replaceAll("-", "_").toUpperCase()}`;
}

function fail(option: string, message: string): never {
  throw new ConfigurationError([{ option, message }]);
}

function parseArguments(argv: readonly string[]): RawConfig {
  const values: RawConfig = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      fail("arguments", "Informe somente argumentos de configuração válidos.");
    }
    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const key = cliKeys.get(name);
    if (key === undefined) {
      fail("arguments", "Argumento de configuração desconhecido.");
    }
    if (Object.hasOwn(values, key)) {
      fail(`--${optionNames[key]}`, "O argumento não pode ser repetido.");
    }
    let value: string | undefined;
    if (equalsIndex !== -1) {
      value = argument.slice(equalsIndex + 1);
    } else {
      value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        fail(`--${optionNames[key]}`, "O argumento exige um valor.");
      }
      index += 1;
    }
    values[key] = value;
  }
  return values;
}

function canonicalIp(value: string): string {
  return isIP(value) === 6
    ? new URL(`http://[${value}]/`).hostname.slice(1, -1)
    : value;
}

function isIpLiteral(value: string): boolean {
  return !value.includes("%") && isIP(value) !== 0;
}

function isUnspecifiedIp(value: string): boolean {
  return value === "0.0.0.0" || value === "::" || value === "::ffff:0:0";
}

//"San" = Subject Alternative Name
function validSan(value: string): boolean {
  if (isIpLiteral(value)) {
    return !isUnspecifiedIp(canonicalIp(value));
  }
  // Numeric dotted values are not accepted as DNS aliases for invalid IPv4.
  if (value.length > 253 || /^[\d.]+$/.test(value)) {
    return false;
  }
  return value
    .split(".")
    .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}

function validOrigin(value: string): boolean {
  if (value === "null") {
    return true;
  }
  if (value.includes("*")) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

function contains(parent: string, candidate: string): boolean {
  //path.relative(A,B) -> "Oque o caminho A tem em comum com o caminho B?"
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith("../") &&
      !path.isAbsolute(relative))
  );
}

function overlaps(first: string, second: string): boolean {
  return contains(first, second) || contains(second, first);
}

const absolutePath = z
  .string({ error: "Informe um caminho absoluto." })
  .refine((value) => path.isAbsolute(value) && !value.includes("\0"), {
    message: "Informe um caminho absoluto sem bytes nulos.",
  })
  .transform((value) => {
    const normalized = path.normalize(value);
    return normalized === "/" ? normalized : normalized.replace(/\/$/, "");
  });

function decimalInteger(maximum: number) {
  return z
    .string({ error: "Informe um inteiro decimal." })
    .regex(/^\d+$/, {
      error: "Use somente dígitos decimais, sem espaços ou unidades.",
    })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Informe um inteiro finito." })
        .int({ error: "Informe um inteiro representável com precisão." })
        .min(1, { error: "O valor deve ser maior que zero." })
        .max(maximum, {
          error: "O valor ultrapassa o máximo permitido para esta opção.",
        }),
    );
}

const jsonInput = z
  .string({ error: "Informe uma lista em JSON." })
  .transform((value, context): unknown => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "Informe JSON válido." });
      return z.NEVER;
    }
  });

const sans = jsonInput
  .pipe(
    z
      .array(
        z
          .string({ error: "Cada identidade deve ser uma string DNS ou IP." })
          .refine(validSan, {
            message: "Informe DNS ou IP válido, sem wildcard, porta ou URL.",
          })
          .transform((value) =>
            isIpLiteral(value) ? canonicalIp(value) : value.toLowerCase(),
          ),
        { error: "Informe um array JSON de identidades DNS ou IP." },
      )
      .min(1, { error: "Informe ao menos uma identidade DNS ou IP." }),
  )
  .refine((values) => new Set(values).size === values.length, {
    message: "Identidades DNS ou IP não podem ser repetidas.",
  });

const origins = jsonInput
  .pipe(
    z.array(
      z
        .string({ error: "Cada origem deve ser uma string." })
        .refine(validOrigin, {
          message: "Informe uma origem HTTP(S) canônica ou o literal null.",
        }),
      { error: "Informe um array JSON de origens." },
    ),
  )
  .refine((values) => new Set(values).size === values.length, {
    message: "Origens não podem ser repetidas.",
  });

const configSchema = z
  .object({
    root: absolutePath,
    host: z
      .string({ error: "Informe um endereço IP de escuta." })
      .refine(isIpLiteral, {
        message: "Informe IPv4 ou IPv6 literal, sem identificador de zona.",
      })
      .transform(canonicalIp),
    port: decimalInteger(65535),
    stateDir: absolutePath,
    stagingDir: absolutePath,
    tlsMode: z.enum(["self-signed", "provided"], {
      error: "Use self-signed ou provided.",
    }),
    tlsSans: sans,
    tlsCertFile: absolutePath,
    tlsKeyFile: absolutePath,
    tokensFile: absolutePath.optional(),
    corsOrigins: origins,
    uploadMaxBytes: decimalInteger(Number.MAX_SAFE_INTEGER),
    zipMaxEntries: decimalInteger(Number.MAX_SAFE_INTEGER),
    zipMaxBytes: decimalInteger(Number.MAX_SAFE_INTEGER),
    jsonMaxBytes: decimalInteger(Number.MAX_SAFE_INTEGER),
    shutdownTimeoutMs: decimalInteger(2147483647),
  })
  .superRefine((config, context) => {
    const addIssue = (key: ConfigKey, message: string): void => {
      context.addIssue({ code: "custom", path: [key], message });
    };
    const directories = ["root", "stateDir", "stagingDir"] as const;
    for (const [index, first] of directories.entries()) {
      for (const second of directories.slice(index + 1)) {
        if (overlaps(config[first], config[second])) {
          addIssue(
            second,
            "Raiz, estado e staging devem ser separados e não podem se conter.",
          );
        }
      }
    }
    if (
      !isUnspecifiedIp(config.host) &&
      !config.tlsSans.includes(config.host)
    ) {
      addIssue(
        "tlsSans",
        "A lista de identidades deve conter o IP concreto de escuta.",
      );
    }
    for (const key of ["tlsCertFile", "tlsKeyFile"] as const) {
      if (
        config.tlsMode === "self-signed" &&
        (!contains(config.stateDir, config[key]) ||
          config[key] === config.stateDir)
      ) {
        addIssue(
          key,
          "O material autoassinado deve ficar dentro do diretório de estado.",
        );
      }
    }
    const materials: readonly [ConfigKey, string][] = [
      ["tlsCertFile", config.tlsCertFile],
      ["tlsKeyFile", config.tlsKeyFile],
      [
        "tokensFile",
        config.tokensFile ?? path.join(config.stateDir, "tokens.json"),
      ],
    ];
    for (const [index, [key, material]] of materials.entries()) {
      if (
        overlaps(config.root, material) ||
        overlaps(config.stagingDir, material) ||
        contains(material, config.stateDir)
      ) {
        addIssue(
          key,
          "Materiais devem ficar fora da raiz e do staging, sem colidir com diretórios.",
        );
      }
      for (const [, otherMaterial] of materials.slice(index + 1)) {
        if (overlaps(material, otherMaterial)) {
          addIssue(
            key,
            "Arquivos de certificado, chave e tokens devem ser distintos e não se conter.",
          );
        }
      }
    }
  });

/** Parses configuration only; does not inspect files, create secrets or open listeners. */
export function loadConfig(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): AppConfig {
  const cli = parseArguments(argv);
  if (
    Object.keys(env).some(
      (key) => key.startsWith("PASSA_") && !envKeys.has(key),
    )
  ) {
    fail("environment", "Variável de configuração PASSA_ desconhecida.");
  }
  const raw: RawConfig = {};
  for (const [key, name] of optionEntries) {
    const value = cli[key] ?? env[environmentName(name)] ?? defaults[key];
    if (value !== undefined) {
      raw[key] = value;
    }
  }
  if (raw.tlsMode === "self-signed" && raw.stateDir !== undefined) {
    raw.tlsCertFile ??= path.join(raw.stateDir, "tls/server.crt");
    raw.tlsKeyFile ??= path.join(raw.stateDir, "tls/server.key");
  }
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigurationError(
      result.error.issues.map((issue) => {
        const field = issue.path[0];
        return {
          option:
            typeof field === "string" && Object.hasOwn(optionNames, field)
              ? `--${optionNames[field as ConfigKey]}`
              : "configuration",
          message: issue.message,
        };
      }),
    );
  }
  const { tokensFile, ...required } = result.data;
  return Object.freeze({
    ...required,
    ...(tokensFile === undefined ? {} : { tokensFile }),
    tlsSans: Object.freeze([...required.tlsSans]),
    corsOrigins: Object.freeze([...required.corsOrigins]),
  });
}
