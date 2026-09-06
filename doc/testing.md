# Verificações e testes

## Estado e limites de cobertura

**Etapa 2: estrutura e configuração verificadas.** Existem manifesto e lock,
compilação TypeScript, fábrica Express sem rotas, parser Zod e comando local de
conferência. Foram executados 46 testes de configuração/bootstrap. Ainda não há
testes de endpoints, autenticação, operações de arquivos ou conexões HTTPS reais.

O resultado atual está registrado abaixo e em [progress.md](progress.md).
As verificações da etapa 1 são um registro histórico; a matriz diferencia o
conjunto de configuração executado dos conjuntos ainda planejados.

## Execução e resultados da etapa 2

Ambiente: **Linux x86_64, Node.js 24.19.0, npm 11.17.0**, TypeScript 7.0.2.
Data: **2026-09-06**. Node.js 24 já estava instalado e foi selecionado somente
nos comandos; a versão padrão do terminal não foi modificada.

Com o runtime de `.nvmrc` selecionado e a partir da raiz do projeto:

```sh
npm ci
npm run check
```

`npm ci` é preparação do ambiente com o lock, não parte de cada inicialização.
Para executar uma verificação isolada, após a instalação:

```sh
npm run typecheck
npm run build
npm test
```

`check` executa os três comandos em sequência. `typecheck` verifica produção e
testes sem emitir JavaScript; `build` compila produção para `dist/`; `test` compila
produção/testes em `.test-build/` e usa `node --test`. Artefatos e dependências são
ignorados pelo Git. Os diretórios de saída não constituem dados compartilhados.

| Verificação executada | Resultado |
| --- | --- |
| `npm install` inicial | 82 pacotes instalados localmente; manifesto e lock criados |
| `npm exec -- tsc --version` e `npm ls --depth=0` | Compilador 7.0.2 executável; cinco dependências diretas nas versões documentadas |
| `npm run check` | Tipos e compilação aprovados; **46 testes passaram, zero falhas e zero ignorados** |
| `npm ci` para conferir reprodução | Concluído sem modificar o lock, verificado por SHA-256 antes/depois; auditoria npm relatou zero vulnerabilidades na consulta |
| `npm run check:config` com os três diretórios de exemplo do README | Código 0 e mensagem explícita de validação somente sintática/lexical, sem inicializar servidor |
| Revisão documental e inventário final | 26 arquivos autorais, 14 documentos, 125 links/âncoras locais válidos; sintaxe de 18 exemplos shell e 5 JSON conferida; 16 opções, cinco exports públicos e manifesto/lock coerentes |
| Exclusões Git | Dependências, builds e nomes de materiais privados conferidos com `git check-ignore`; nenhum segredo de execução criado |

Uma dúvida levantada na revisão de regex também foi conferida diretamente no runtime:
as seis combinações de PORT/SAN com LF, CRLF ou CR finais foram rejeitadas, conforme
o contrato. Essa conferência pontual não alterou código ou a contagem dos 46 testes.

O lock permaneceu com SHA-256
`fb814c5e410adda42e310e19a2e7efe158e0cf6d00fd38cc7578c82559e196f6` nessa verificação.
O resultado da auditoria npm é pontual e não equivale a uma garantia geral de segurança.

### Conjuntos implementados

- [tests/config.test.ts](../tests/config.test.ts): **42 testes**, incluindo campos
  obrigatórios, os 16 pares CLI/ambiente, defaults, precedência e substituição de
  listas, opções desconhecidas/duplicadas, limites e formatos numéricos, JSON,
  caminhos absolutos/colisões lexicais, modos TLS e caminhos de materiais, SAN/IP,
  CORS canônico, imutabilidade e ausência de valores privados em diagnósticos.
- [tests/bootstrap.test.ts](../tests/bootstrap.test.ts): **4 testes** em subprocessos;
  sucesso do comando sem criar diretórios, erros com saída 2 sem eco de valores,
  opção desconhecida sanitizada e importação/montagem Express sem listener ou
  processo mantido ativo. Somente o teste de ausência de criação usa diretório
  temporário exclusivo, removido após o caso; outros caminhos são apenas strings.

As verificações não leem a pasta do operador nem geram tokens/certificados. O parser
é puro, então aceitar um caminho configurado não comprova existência, acesso,
propriedade, ausência de symlink, filesystem ou relação física com o repositório.
Os testes de TLS/SAN desta etapa verificam valores de configuração, não handshakes
ou certificados reais. O ramo de falha inesperada com saída 1 na CLI está implementado,
mas não foi exercitado por injeção artificial de falha.

Fonte do mecanismo de execução: [test runner do Node.js 24](https://nodejs.org/docs/latest-v24.x/api/test.html).

## Verificação documental da etapa 1

Procedimentos da revisão, sem dependências adicionais do projeto:

1. Conferir os 13 arquivos obrigatórios: `README.md`, `AGENTS.md` e os 11 documentos
   obrigatórios em `doc/`. Conferir também a cópia adicional `doc/requirements.md`.
2. Comparar a cópia da especificação com o anexo recebido, preservando seu conteúdo.
3. Verificar destinos de links Markdown locais, fechamento de blocos de código,
   espaços ao fim de linha e arquivos autorais com quebra de linha final. A cópia
   literal do pedido conserva a formatação original, inclusive ausência de newline
   final; sua verificação é por igualdade integral de bytes com o anexo.
4. Conferir as dez combinações método/rota e as regras da especificação contra
   `endpoints.md`, `filesystem.md`, `security.md`, `configuration.md` e `errors.md`.
5. Revisar a distinção entre requisito aprovado, proposta e comportamento implementado;
   referências a handlers/símbolos inexistentes devem ser explicitamente pendentes.
6. Conferir as nove etapas, limite da autorização atual e estado de pausa final.
7. Revisar inventário/diff para confirmar que a entrega contém somente documentação.

Comandos de inspeção que podem ser utilizados no repositório:

```sh
git status --short --branch
rg --files --hidden -g '!.git' -g '!node_modules'
git diff --check
```

`git diff --check` cobre alterações rastreadas; como a etapa inicial cria arquivos
ainda não rastreados, a revisão também deverá ler os novos Markdown diretamente ou
usar `git diff --no-index --check /dev/null CAMINHO_DO_DOCUMENTO` para cada arquivo.
Não executar comandos de instalação ou testes de aplicação para completar esta etapa.

Resultado em 2026-09-05: **revisão documental aprovada**.

- Os 13 documentos obrigatórios e a cópia adicional da especificação estavam presentes;
  o inventário daquela etapa continha somente esses 14 arquivos Markdown, além de `.git`.
- A especificação foi comparada byte a byte com o anexo e está idêntica.
- Links locais e âncoras foram resolvidos; os 13 arquivos autorais passaram nas
  verificações de UTF-8, blocos fechados, newline final, espaços finais e diff.
- 14 blocos shell tiveram sintaxe verificada por `sh -n`, sem executar seu conteúdo;
  5 blocos JSON foram analisados com sucesso. Nenhum comando curl ou npm dos exemplos
  foi executado.
- As dez combinações método/rota e as categorias documentais por endpoint foram
  conferidas; as nove etapas estão registradas na ordem do pedido.
- Revisão cruzada de requisitos/contrato/configuração/erros/segurança foi realizada.
  Foram alinhados limite JSON e erro 413, alcance da rejeição de duplicatas e
  exigência de `overwrite` somente para substituição de destino existente.
- As verificações mecânicas utilizaram um script temporário em memória, com a
  biblioteca padrão de Python 3, `rg`, `sh -n` e `git diff --no-index --check`.
  Não foi criado script executável no projeto nem instalada ferramenta adicional.

A inspeção inicial do Git/diretório também foi executada e confirmou somente `.git`,
sem commits nem arquivos de aplicação. Na etapa 1 não foram executados testes
funcionais, compilação, instalação ou conexões HTTPS. O avanço da etapa 2 consta
separadamente acima.

## Matriz de testes planejados

O conjunto da **etapa 2 está implementado e executado** no alcance descrito acima.
Os conjuntos das **etapas 3–9 ainda não foram implementados ou executados**.
Cada conjunto entra na etapa correspondente e deve ser mantido após alterações.

| Etapa | Conjunto | Comportamento observável a verificar |
| --- | --- | --- |
| 2 | Estrutura e configuração — executado | Instalação local com lock; compilação/tipos; opções ausentes, inválidas, limites numéricos, listas e precedência CLI/ambiente/default; relações lexicais de caminhos; importação sem iniciar escuta |
| 3 | Autenticação isolada | Tokens ausentes, inválidos e válidos; preparação segura de tokens temporários/externos, ciclo de vida e comparação; mensagens/logs sem credenciais |
| 3 | Caminhos | Raiz `.`, caminhos válidos, absolutos, `..`, nulos, barras repetidas/finais, nomes com espaços/especiais, representação URL decodificada uma vez, campos inválidos, symlinks diretos/intermediários, arquivos privados inacessíveis |
| 4 | Autenticação em rotas | Proteger `/health` e cada rota de consulta; validar 401 e `WWW-Authenticate`; acrescentar verificação de cada nova rota nas etapas 5–7 |
| 4 | Saúde e metadados | 200 mínimo autenticado, representação comum camelCase, raiz sem caminho absoluto, `size: null` para diretórios, bytes para arquivos, UTC e 404 |
| 4 | Listagem | Somente filhos imediatos, raiz default, grupos/ordenação determinísticos, arquivo incompatível, espaços, especiais e política de links |
| 4 | Download | Bytes exatos, apenas arquivo regular, headers e nome seguro, processamento incremental, erro antes/depois dos headers e liberação após desconexão |
| 5 | Diretórios | Pais ausentes, 201+Location novo, 200 repetido preservando conteúdo, raiz, arquivo conflitante e ausência de corpo |
| 5 | Upload | Um campo de arquivo exato, campos/arquivos extras rejeitados, destino definido pelo path, pais existentes, 201+metadados+Location novo, 204 sem corpo em substituição, diretório conflitante, MIME incorreto, limite configurável |
| 5 | Falhas de upload | Recebimento interrompido, multipart inválido após dados, limite excedido e falha de publicação preservam o destino anterior; staging limpo; autenticação antes do processamento integral |
| 6 | Exclusão | Arquivo, diretório vazio, não vazio com/sem recursive=true, default false, raiz proibida, inexistente 404, sucesso 204 sem corpo, repetição e falhas recursivas parciais documentadas |
| 6 | Movimentação e renomeação | name/parentPath isolados e combinados, omitido vs null, corpo vazio/campos extras, name sem separadores, pai existente, no-op, metadados resultantes, raiz protegida, conflito e overwrite apenas arquivo regular |
| 6 | Restrições de movimento | Diretório para si/descendente, ancestral contendo origem, política de links, EXDEV rejeitado sem cópia/exclusão silenciosa |
| 7 | Cópia | Arquivo e árvore, target final completo, pai existente, origem igual ao destino, raiz e descendentes proibidos, sem mesclagem, overwrite somente arquivos, status 201/200 e Location conforme criação |
| 7 | Falhas de cópia | Links/especiais dentro da árvore, falhas de leitura/publicação preservando destino, remoção apenas do staging da própria operação, conflitos e cleanup |
| 7 | ZIP | Corpo JSON obrigatório, path default `.`, apenas diretório, entradas relativas, diretórios vazios, raiz, Content-Type/Disposition, limites de entradas e volume, ausência de caminhos absolutos/escape/internos |
| 7 | Falhas e recursos ZIP | Links na árvore, limite antes da resposta, processamento incremental sem ZIP inteiro em memória, remoção de temporários no sucesso/erro/desconexão |
| 8 | HTTPS real | Cliente confia no certificado/CA de teste e valida identidade; certificado não confiável ou identidade errada falham; TLS mínimo; nenhuma porta ou fallback HTTP |
| 8 | Ciclo de certificados | Autoassinado com SAN, chave correspondente, validade/reutilização/renovação; certificado fornecido inválido impede startup, não é sobrescrito; reinício carrega renovação |
| 8 | CORS | Origem configurada recebe autorização, origem não permitida não recebe autorização CORS, preflight sem Bearer, métodos/headers necessários, headers expostos, operação efetiva exige token, Origin null somente explícito |
| 8 | Startup/encerramento | Configuração/chave/certificado inválidos e porta ocupada impedem prontidão; nenhuma correção automática do sistema; recursos próprios liberados ao encerrar |
| 9 | Revisão final | Comando documentado realmente inicia HTTPS, contrato coincide com código/testes, exemplos funcionam com confiança TLS, nenhuma funcionalidade futura anunciada, segredos ausentes do Git e da raiz |

## Regras transversais de teste

- Testar métodos, formatos, Content-Types, headers, obrigatoriedade/defaults, campos
  desconhecidos, JSON malformado e erros de esquema para cada endpoint correspondente.
- Nas rotas JSON das etapas 6–7, verificar também `413 payload_too_large` quando
  o corpo ultrapassar `PASSA_JSON_MAX_BYTES`, inclusive sem `Content-Length`.
- Verificar `application/problem+json`, status/código consistente e ausência de
  caminhos absolutos, stack traces e segredos. Respostas 204 nunca contêm corpo.
- Testar origem, destino e componentes intermediários, inclusive durante operações
  recursivas. Não limitar segurança a testes de comparação textual de prefixo.
- Usar diretórios temporários exclusivos; jamais a pasta real de arquivos do operador.
  Certificados e credenciais de teste também serão exclusivos e temporários.
- Observar conteúdo antes/depois das falhas; não substituir verificações de
  preservação/limpeza por testes que só confirmam chamadas internas.
- Documentar o alcance da concorrência testada. Um teste com mutex interno não
  demonstra proteção absoluta contra processos externos nem contra todas as montagens.
- As etapas intermediárias podem testar HTTP internamente sem rede; isso não
  autoriza um modo normal de execução HTTP. A etapa 8 exige conexões TLS reais.
- Quando o ambiente não permitir uma verificação, registrar o caso exato e o motivo;
  não contar caso ignorado/bloqueado como aprovado.

## Verificações pendentes das etapas seguintes

`npm test` executa somente os conjuntos já implementados. Testes das rotas serão
adicionados com seus handlers; testes reais de HTTPS entram na etapa 8. Ainda não
existe `npm start` nem comando normal para servir arquivos. O progresso de cada
novo conjunto deve registrar execução real e limitações, sem promover cenários
planejados a testes aprovados.
