import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const command = fileURLToPath(new URL('../src/check-config.js', import.meta.url));

function isolatedEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('PASSA_')),
  );
}

test('conferência válida termina sem criar diretórios ou anunciar um servidor pronto', (context) => {
  const sandbox = mkdtempSync(join(tmpdir(), 'passa-config-'));
  context.after(() => rmSync(sandbox, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [command], {
    env: {
      ...isolatedEnvironment(),
      PASSA_ROOT: join(sandbox, 'compartilhada'),
      PASSA_STATE_DIR: join(sandbox, 'estado privado'),
      PASSA_STAGING_DIR: join(sandbox, 'staging'),
    },
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /configuração válidas/);
  assert.match(result.stdout, /não foram verificados/);
  assert.match(result.stdout, /Nenhum servidor foi iniciado/);
  assert.ok(!result.stdout.includes(sandbox));
  assert.deepEqual(readdirSync(sandbox), []);
});

test('CLI aceita argumentos e retorna código 2 para configuração inválida sem eco de valores', () => {
  const sentinel = 'valor-privado-que-nao-deve-aparecer';
  const result = spawnSync(process.execPath, [command,
    '--root', '/dados/compartilhada',
    '--state-dir', '/dados/estado',
    '--staging-dir', '/dados/staging',
    '--port', sentinel,
  ], {
    env: isolatedEnvironment(),
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Configuração inválida/);
  assert.ok(!result.stderr.includes(sentinel));
  assert.ok(!result.stderr.includes('/dados/'));
  assert.ok(!result.stderr.includes('at file:'));
});

test('CLI rejeita opções desconhecidas sem publicar sua chave ou valor', () => {
  const sentinel = 'sentinela-privada';
  const result = spawnSync(process.execPath, [command, `--${sentinel}=${sentinel}`], {
    env: isolatedEnvironment(),
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.ok(!result.stderr.includes(sentinel));
});

test('importar configuração e criar a aplicação Express não abre listeners nem mantém o processo ativo', () => {
  const appUrl = new URL('../src/app.js', import.meta.url).href;
  const configUrl = new URL('../src/config/index.js', import.meta.url).href;
  const script = [
    `import { createApp } from ${JSON.stringify(appUrl)};`,
    `import ${JSON.stringify(configUrl)};`,
    'createApp();',
    'if (process.getActiveResourcesInfo().includes("TCPServerWrap")) process.exitCode = 1;',
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: isolatedEnvironment(),
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
