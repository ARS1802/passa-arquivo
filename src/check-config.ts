import { ConfigurationError, loadConfig } from './config/index.js';

// Este comando confere somente a configuração; não inicia ou prepara o servidor.
try {
  loadConfig(process.argv.slice(2), process.env);
  process.stdout.write(
    'Sintaxe e relações da configuração válidas. Diretórios, certificados e tokens não foram verificados. Nenhum servidor foi iniciado.\n',
  );
} catch (error: unknown) {
  if (error instanceof ConfigurationError) {
    process.stderr.write('Configuração inválida.\n');
    for (const issue of error.issues) {
      process.stderr.write(`${issue.option}: ${issue.message}\n`);
    }
    process.exitCode = 2;
  } else {
    process.stderr.write('Falha inesperada ao conferir a configuração.\n');
    process.exitCode = 1;
  }
}
