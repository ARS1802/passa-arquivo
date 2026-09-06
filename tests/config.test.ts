import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ConfigurationError, loadConfig } from '../src/config/index.js';

type Environment = Readonly<Record<string, string | undefined>>;

// These paths are values only: configuration tests never create or inspect them.
const basePath = '/tmp/passa-config-tests';
const baseEnvironment: Environment = Object.freeze({
  PASSA_ROOT: `${basePath}/shared`,
  PASSA_STATE_DIR: `${basePath}/private-state`,
  PASSA_STAGING_DIR: `${basePath}/private-staging`,
});

function environment(overrides: Environment = {}): Environment {
  return { ...baseEnvironment, ...overrides };
}

function expectConfigurationError(
  action: () => unknown,
  forbiddenValues: readonly string[] = [],
): ConfigurationError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof ConfigurationError, 'Expected ConfigurationError');
  assert.ok(caught.issues.length > 0, 'A configuration error must explain its fields');
  for (const issue of caught.issues) {
    assert.equal(typeof issue.option, 'string');
    assert.equal(typeof issue.message, 'string');
    assert.ok(issue.option.length > 0);
    assert.ok(issue.message.length > 0);
  }

  const publicDiagnostic = [
    caught.message,
    String(caught),
    JSON.stringify(caught),
    JSON.stringify(caught.issues),
  ].join('\n');
  for (const value of forbiddenValues) {
    assert.ok(!publicDiagnostic.includes(value), 'Diagnostic exposed a supplied value');
  }
  return caught;
}

test('requires the three explicit directory options', () => {
  expectConfigurationError(() => loadConfig([], {}));
  for (const option of ['PASSA_ROOT', 'PASSA_STATE_DIR', 'PASSA_STAGING_DIR']) {
    expectConfigurationError(() => loadConfig([], environment({ [option]: undefined })));
  }
});

test('applies documented defaults without reading files or preparing directories', () => {
  assert.deepEqual(loadConfig([], baseEnvironment), {
    root: `${basePath}/shared`,
    host: '127.0.0.1',
    port: 8443,
    stateDir: `${basePath}/private-state`,
    stagingDir: `${basePath}/private-staging`,
    tlsMode: 'self-signed',
    tlsSans: ['localhost', '127.0.0.1'],
    tlsCertFile: `${basePath}/private-state/tls/server.crt`,
    tlsKeyFile: `${basePath}/private-state/tls/server.key`,
    corsOrigins: [],
    uploadMaxBytes: 1_073_741_824,
    zipMaxEntries: 10_000,
    zipMaxBytes: 10_737_418_240,
    jsonMaxBytes: 16_384,
    shutdownTimeoutMs: 10_000,
  });
  assert.equal(Object.hasOwn(loadConfig([], baseEnvironment), 'tokensFile'), false);
});

const configuredOptions = [
  ['root', 'PASSA_ROOT', `${basePath}/configured shared`],
  ['host', 'PASSA_HOST', '192.0.2.7'],
  ['port', 'PASSA_PORT', '9443'],
  ['state-dir', 'PASSA_STATE_DIR', `${basePath}/configured state`],
  ['staging-dir', 'PASSA_STAGING_DIR', `${basePath}/configured staging`],
  ['tls-mode', 'PASSA_TLS_MODE', 'provided'],
  ['tls-sans', 'PASSA_TLS_SANS', '["192.0.2.7","files.example.test"]'],
  ['tls-cert-file', 'PASSA_TLS_CERT_FILE', `${basePath}/operator-tls/fullchain.pem`],
  ['tls-key-file', 'PASSA_TLS_KEY_FILE', `${basePath}/operator-tls/private-key.pem`],
  ['tokens-file', 'PASSA_TOKENS_FILE', `${basePath}/operator-tokens/tokens.json`],
  ['cors-origins', 'PASSA_CORS_ORIGINS', '["https://files.example.test:8443","null"]'],
  ['upload-max-bytes', 'PASSA_UPLOAD_MAX_BYTES', '524288'],
  ['zip-max-entries', 'PASSA_ZIP_MAX_ENTRIES', '250'],
  ['zip-max-bytes', 'PASSA_ZIP_MAX_BYTES', '1048576'],
  ['json-max-bytes', 'PASSA_JSON_MAX_BYTES', '4096'],
  ['shutdown-timeout-ms', 'PASSA_SHUTDOWN_TIMEOUT_MS', '3000'],
] as const;

const configuredResult = {
  root: `${basePath}/configured shared`,
  host: '192.0.2.7',
  port: 9443,
  stateDir: `${basePath}/configured state`,
  stagingDir: `${basePath}/configured staging`,
  tlsMode: 'provided',
  tlsSans: ['192.0.2.7', 'files.example.test'],
  tlsCertFile: `${basePath}/operator-tls/fullchain.pem`,
  tlsKeyFile: `${basePath}/operator-tls/private-key.pem`,
  tokensFile: `${basePath}/operator-tokens/tokens.json`,
  corsOrigins: ['https://files.example.test:8443', 'null'],
  uploadMaxBytes: 524_288,
  zipMaxEntries: 250,
  zipMaxBytes: 1_048_576,
  jsonMaxBytes: 4096,
  shutdownTimeoutMs: 3000,
};

test('accepts every documented option from the environment', () => {
  const values = Object.fromEntries(configuredOptions.map(([, name, value]) => [name, value]));
  assert.deepEqual(loadConfig([], values), configuredResult);
});

for (const syntax of ['separate', 'equals'] as const) {
  test(`accepts every CLI option using ${syntax} syntax`, () => {
    const argv = configuredOptions.flatMap(([name, , value]) =>
      syntax === 'separate' ? [`--${name}`, value] : [`--${name}=${value}`],
    );
    assert.deepEqual(loadConfig(argv, {}), configuredResult);
  });
}

test('CLI replaces all known environment values before validation, even invalid values', () => {
  const argv = configuredOptions.map(([name, , value]) => `--${name}=${value}`);
  const invalidEnvironment = Object.fromEntries(
    configuredOptions.map(([, name]) => [name, 'INVALID_OVERRIDDEN_VALUE']),
  );
  assert.deepEqual(loadConfig(argv, invalidEnvironment), configuredResult);
});

test('CLI overrides individual values while retaining other environment settings and defaults', () => {
  const config = loadConfig(['--port', '9443'], environment({
    PASSA_PORT: '8444',
    PASSA_UPLOAD_MAX_BYTES: '2048',
  }));
  assert.equal(config.port, 9443);
  assert.equal(config.uploadMaxBytes, 2048);
  assert.equal(config.jsonMaxBytes, 16_384);
  assert.equal(config.root, `${basePath}/shared`);
});

test('CLI equals syntax preserves additional equals signs within a path value', () => {
  const config = loadConfig([`--root=${basePath}/shared=name`], baseEnvironment);
  assert.equal(config.root, `${basePath}/shared=name`);
});

test('CLI replaces whole arrays instead of concatenating them with the environment', () => {
  const config = loadConfig(
    ['--tls-sans=["127.0.0.1"]', '--cors-origins=[]'],
    environment({
      PASSA_TLS_SANS: '["localhost","127.0.0.1","files.example.test"]',
      PASSA_CORS_ORIGINS: '["https://client.example.test"]',
    }),
  );
  assert.deepEqual(config.tlsSans, ['127.0.0.1']);
  assert.deepEqual(config.corsOrigins, []);
});

test('an explicitly empty CLI value is invalid and does not fall back to the environment', () => {
  expectConfigurationError(() => loadConfig(['--port='], environment({ PASSA_PORT: '8443' })));
});

test('ignores environment variables outside the PASSA_ namespace', () => {
  assert.deepEqual(
    loadConfig([], environment({ PORT: 'invalid', NODE_ENV: 'development', unrelated: 'secret' })),
    loadConfig([], baseEnvironment),
  );
});

test('rejects unknown PASSA_ variables without exposing their names or values', () => {
  const privateName = 'PASSA_SECRET_UNKNOWN_OPTION_9F21';
  const privateValue = 'secret-environment-value-8921';
  expectConfigurationError(
    () => loadConfig(['--port=9443'], environment({ [privateName]: privateValue })),
    [privateName, privateValue],
  );
});

test('rejects unknown CLI options without exposing arbitrary names or values', () => {
  const privateName = '--secret-unknown-option-9f21';
  const privateValue = 'secret-command-line-value-8921';
  for (const argv of [[privateName, privateValue], [`${privateName}=${privateValue}`]]) {
    expectConfigurationError(() => loadConfig(argv, baseEnvironment), [privateName, privateValue]);
  }
});

test('rejects CLI duplicates, positionals, missing values and unsupported flags', () => {
  const invalidArguments = [
    ['--port=8443', '--port', '9443'],
    ['--port', '8443', '--port=8443'],
    ['--cors-origins=[]', '--cors-origins=[]'],
    ['--root'],
    ['--port', '--host', '127.0.0.1'],
    ['unexpected-positional'],
    ['-p', '8443'],
    ['--'],
  ];
  for (const argv of invalidArguments) {
    expectConfigurationError(() => loadConfig(argv, baseEnvironment));
  }
});

const numericOptions = [
  ['PASSA_PORT', 'port', 65_535],
  ['PASSA_UPLOAD_MAX_BYTES', 'uploadMaxBytes', Number.MAX_SAFE_INTEGER],
  ['PASSA_ZIP_MAX_ENTRIES', 'zipMaxEntries', Number.MAX_SAFE_INTEGER],
  ['PASSA_ZIP_MAX_BYTES', 'zipMaxBytes', Number.MAX_SAFE_INTEGER],
  ['PASSA_JSON_MAX_BYTES', 'jsonMaxBytes', Number.MAX_SAFE_INTEGER],
  ['PASSA_SHUTDOWN_TIMEOUT_MS', 'shutdownTimeoutMs', 2_147_483_647],
] as const;

for (const [option, field, maximum] of numericOptions) {
  test(`${option} accepts both bounds and rejects values outside them`, () => {
    assert.equal(loadConfig([], environment({ [option]: '1' }))[field], 1);
    assert.equal(loadConfig([], environment({ [option]: String(maximum) }))[field], maximum);
    expectConfigurationError(() => loadConfig([], environment({ [option]: '0' })));
    expectConfigurationError(() => loadConfig([], environment({ [option]: String(maximum + 1) })));
  });

  test(`${option} rejects non-decimal and ambiguous numeric input`, () => {
    for (const value of ['', '-1', '+1', '1.0', '1e3', '0x10', '1_000', ' 10', '10 ', '10MB', 'NaN', 'Infinity']) {
      expectConfigurationError(() => loadConfig([], environment({ [option]: value })));
    }
  });
}

test('arrays require JSON arrays of unique string elements', () => {
  const invalidArrays = ['', 'localhost,127.0.0.1', 'null', '{}', '"localhost"', '[', '[true]', '[1]', '[null]', '[{}]', '[""]'];
  for (const option of ['PASSA_TLS_SANS', 'PASSA_CORS_ORIGINS']) {
    for (const value of invalidArrays) {
      expectConfigurationError(() => loadConfig([], environment({ [option]: value })));
    }
  }
  expectConfigurationError(() => loadConfig([], environment({ PASSA_TLS_SANS: '[]' })));
  expectConfigurationError(() => loadConfig([], environment({ PASSA_TLS_SANS: '["127.0.0.1","127.0.0.1"]' })));
  expectConfigurationError(() => loadConfig([], environment({ PASSA_CORS_ORIGINS: '["null","null"]' })));
});

test('configuration paths must be absolute and contain no NUL, without exposing values', () => {
  const options = ['PASSA_ROOT', 'PASSA_STATE_DIR', 'PASSA_STAGING_DIR', 'PASSA_TLS_CERT_FILE', 'PASSA_TLS_KEY_FILE', 'PASSA_TOKENS_FILE'];
  for (const option of options) {
    for (const value of ['relative-secret-path-48', 'C:\\private\\material', '\\\\server\\private', `${basePath}/secret\0path`, '']) {
      const forbiddenValues = value === '' ? [] : [value, value.replace('\0', '\\u0000')];
      expectConfigurationError(() => loadConfig([], environment({ [option]: value })), forbiddenValues);
    }
  }
});

test('normalizes lexical path components while preserving legitimate spaces', () => {
  const config = loadConfig([], environment({
    PASSA_ROOT: `${basePath}/unused/../ shared folder `,
    PASSA_STATE_DIR: `${basePath}/./private state `,
    PASSA_STAGING_DIR: `${basePath}//private staging `,
  }));
  assert.equal(config.root, `${basePath}/ shared folder `);
  assert.equal(config.stateDir, `${basePath}/private state `);
  assert.equal(config.stagingDir, `${basePath}/private staging `);
  assert.equal(config.tlsCertFile, `${basePath}/private state /tls/server.crt`);
});

test('rejects identical, ancestor and descendant directory configurations', () => {
  const options = ['PASSA_ROOT', 'PASSA_STATE_DIR', 'PASSA_STAGING_DIR'];
  for (const first of options) {
    for (const second of options) {
      if (first === second) continue;
      for (const secondPath of [`${basePath}/overlap`, `${basePath}/overlap/child`]) {
        expectConfigurationError(() => loadConfig([], environment({
          [first]: `${basePath}/overlap`,
          [second]: secondPath,
        })));
      }
    }
  }
  expectConfigurationError(() => loadConfig([], environment({ PASSA_ROOT: '/' })));
  expectConfigurationError(() => loadConfig([], environment({
    PASSA_STATE_DIR: `${basePath}/shared/ignored/../state`,
  })));
});

test('checks path components rather than treating a textual prefix as containment', () => {
  const config = loadConfig([], environment({
    PASSA_ROOT: `${basePath}/data`,
    PASSA_STATE_DIR: `${basePath}/data-state`,
    PASSA_STAGING_DIR: `${basePath}/data-staging`,
  }));
  assert.equal(config.stateDir, `${basePath}/data-state`);
});

test('rejects credentials configured inside the shared root or staging', () => {
  for (const option of ['PASSA_TLS_CERT_FILE', 'PASSA_TLS_KEY_FILE', 'PASSA_TOKENS_FILE']) {
    for (const directory of ['shared', 'private-staging']) {
      expectConfigurationError(() => loadConfig([], environment({
        PASSA_TLS_MODE: 'provided',
        PASSA_TLS_CERT_FILE: `${basePath}/operator-tls/server.crt`,
        PASSA_TLS_KEY_FILE: `${basePath}/operator-tls/server.key`,
        [option]: `${basePath}/${directory}/secret-material.pem`,
      })));
    }
  }
});

test('provided TLS mode requires explicit distinct certificate and key paths', () => {
  expectConfigurationError(() => loadConfig([], environment({ PASSA_TLS_MODE: 'provided' })));
  for (const option of ['PASSA_TLS_CERT_FILE', 'PASSA_TLS_KEY_FILE']) {
    expectConfigurationError(() => loadConfig([], environment({
      PASSA_TLS_MODE: 'provided',
      [option]: `${basePath}/operator-tls/material.pem`,
    })));
  }
  expectConfigurationError(() => loadConfig([], environment({
    PASSA_TLS_MODE: 'provided',
    PASSA_TLS_CERT_FILE: `${basePath}/operator-tls/material.pem`,
    PASSA_TLS_KEY_FILE: `${basePath}/operator-tls/./material.pem`,
  })));
  for (const mode of ['', 'http', 'auto', 'SELF-SIGNED']) {
    expectConfigurationError(() => loadConfig([], environment({ PASSA_TLS_MODE: mode })));
  }
});

test('self-signed TLS paths stay below stateDir and can be explicitly customized', () => {
  const config = loadConfig([], environment({
    PASSA_TLS_CERT_FILE: `${basePath}/private-state/certificates/custom.crt`,
    PASSA_TLS_KEY_FILE: `${basePath}/private-state/certificates/custom.key`,
  }));
  assert.equal(config.tlsCertFile, `${basePath}/private-state/certificates/custom.crt`);
  assert.equal(config.tlsKeyFile, `${basePath}/private-state/certificates/custom.key`);
  for (const option of ['PASSA_TLS_CERT_FILE', 'PASSA_TLS_KEY_FILE']) {
    expectConfigurationError(() => loadConfig([], environment({
      [option]: `${basePath}/outside-state/material.pem`,
    })));
    expectConfigurationError(() => loadConfig([], environment({
      [option]: `${basePath}/private-state`,
    })));
  }
});

test('certificate, key and token files cannot overwrite each other or contain each other', () => {
  for (const tokensFile of [
    `${basePath}/private-state/tls/server.crt`,
    `${basePath}/private-state/tls/server.key`,
    `${basePath}/private-state/tls`,
    `${basePath}/private-state/tls/server.crt/child`,
    `${basePath}/private-state`,
  ]) {
    expectConfigurationError(() => loadConfig([], environment({ PASSA_TOKENS_FILE: tokensFile })));
  }
  for (const option of ['PASSA_TLS_CERT_FILE', 'PASSA_TLS_KEY_FILE']) {
    expectConfigurationError(() => loadConfig([], environment({
      [option]: `${basePath}/private-state/tokens.json`,
    })));
  }
});

test('requires a literal bind address and a matching SAN for concrete addresses', () => {
  for (const host of ['', 'localhost', 'https://localhost', '127.0.0.1:8443', '[::1]', 'fe80::1%eth0', ' 127.0.0.1']) {
    expectConfigurationError(() => loadConfig([], environment({ PASSA_HOST: host })));
  }
  expectConfigurationError(() => loadConfig([], environment({ PASSA_HOST: '192.0.2.8' })));
  assert.equal(loadConfig([], environment({
    PASSA_HOST: '192.0.2.8',
    PASSA_TLS_SANS: '["192.0.2.8"]',
  })).host, '192.0.2.8');
  assert.equal(loadConfig([], environment({
    PASSA_HOST: '::1',
    PASSA_TLS_SANS: '["0:0:0:0:0:0:0:1"]',
  })).host, '::1');
});

test('unspecified bind addresses do not have to occur in the SAN list', () => {
  for (const host of ['0.0.0.0', '::']) {
    assert.equal(loadConfig([], environment({ PASSA_HOST: host })).host, host);
  }
});

test('SANs reject invalid identities, unspecified IPs and equivalent duplicates', () => {
  for (const identity of ['https://files.example.test', 'files.example.test:8443', '*.example.test', '0.0.0.0', '::', 'file name', 'fe80::1%eth0']) {
    expectConfigurationError(() => loadConfig([], environment({
      PASSA_TLS_SANS: JSON.stringify(['127.0.0.1', identity]),
    })));
  }
  for (const identities of [
    ['127.0.0.1', 'files.example.test', 'FILES.EXAMPLE.TEST'],
    ['127.0.0.1', '::1', '0:0:0:0:0:0:0:1'],
  ]) {
    expectConfigurationError(() => loadConfig([], environment({
      PASSA_TLS_SANS: JSON.stringify(identities),
    })));
  }
});

test('CORS accepts canonical HTTP origins and null only by explicit configuration', () => {
  assert.deepEqual(loadConfig([], baseEnvironment).corsOrigins, []);
  const allowedOrigins = ['http://localhost:5173', 'https://client.example.test', 'http://[::1]:5173', 'null'];
  assert.deepEqual(loadConfig([], environment({
    PASSA_CORS_ORIGINS: JSON.stringify(allowedOrigins),
  })).corsOrigins, allowedOrigins);
});

test('CORS rejects wildcards, opaque URLs, credentials and noncanonical origins', () => {
  const invalidOrigins = ['*', 'file://', 'data:text/plain,test', 'ftp://files.example.test', 'https://user:pass@example.test', 'https://example.test/', 'https://example.test/path', 'https://example.test?query=1', 'https://example.test#fragment', 'HTTPS://example.test', 'https://EXAMPLE.test', 'https://example.test:443', ' null '];
  for (const origin of invalidOrigins) {
    expectConfigurationError(() => loadConfig([], environment({
      PASSA_CORS_ORIGINS: JSON.stringify([origin]),
    })));
  }
});

test('returns immutable configuration and arrays without mutating the inputs', () => {
  const argv = Object.freeze(['--cors-origins=["null"]']);
  const suppliedEnvironment = Object.freeze({ ...baseEnvironment });
  const config = loadConfig(argv, suppliedEnvironment);

  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.tlsSans), true);
  assert.equal(Object.isFrozen(config.corsOrigins), true);
  assert.throws(() => Object.assign(config, { port: 80 }), TypeError);
  assert.throws(() => Object.defineProperty(config.tlsSans, '0', { value: 'changed' }), TypeError);
  assert.throws(() => Object.defineProperty(config.corsOrigins, '0', { value: '*' }), TypeError);
  assert.equal(config.port, 8443);
  assert.deepEqual(argv, ['--cors-origins=["null"]']);
  assert.deepEqual(suppliedEnvironment, baseEnvironment);
});

test('invalid values are absent from diagnostics across scalar and structured input', () => {
  const secret = 'private-secret-value-716428';
  for (const option of ['PASSA_PORT', 'PASSA_HOST', 'PASSA_TLS_MODE', 'PASSA_ROOT']) {
    expectConfigurationError(() => loadConfig([], environment({ [option]: secret })), [secret]);
  }
  for (const option of ['PASSA_TLS_SANS', 'PASSA_CORS_ORIGINS']) {
    expectConfigurationError(() => loadConfig([], environment({ [option]: JSON.stringify([secret, 1]) })), [secret]);
  }
});
