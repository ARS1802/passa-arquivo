# Histórico de preparação e verificações

Registros transferidos dos guias de configuração e testes em 2026-09-17.
As datas, versões consultadas e resultados abaixo se referem às execuções
originais; a revisão de linguagem não repetiu instalação nem testes da aplicação.

## Ambiente e versões registrados na configuração

Versões efetivamente utilizadas na preparação da etapa 2, em **2026-09-06**:

| Componente | Versão utilizada | Estado e papel |
| --- | --- | --- |
| Node.js | `24.19.0` | Runtime LTS já instalado no ambiente; nenhum runtime novo instalado |
| npm | `11.17.0` | Já disponível com esse runtime; preparação de dependências e lock |
| TypeScript | `7.0.2` | Instalado em desenvolvimento; compilador local `tsc` |
| Express | `5.2.1` | Instalado em execução; estrutura HTTP mínima, sem endpoints do contrato |
| Zod | `4.5.4` | Instalado em execução; validação da configuração |
| `@types/node` | `24.13.3` | Instalado em desenvolvimento; tipos da linha Node.js 24 |
| `@types/express` | `5.0.6` | Instalado em desenvolvimento; tipos da linha Express 5 |

O manifesto exige Node.js `>=24.19.0 <25` e npm `>=11 <12`; `.nvmrc` registra
`24.19.0` e `packageManager` registra `npm@11.17.0`. O Node.js 24 existente foi
selecionado por `PATH` somente nos comandos da etapa. O Node.js 20 padrão do ambiente
não foi alterado e não atende ao requisito do projeto.

A consulta upstream de **2026-09-05** encontrou Node.js `24.20.0` disponível com
npm `11.19.0`; essas duas versões não foram instaladas ou executadas aqui. Os pacotes
npm usados coincidem com as versões consultadas: TypeScript `7.0.2` (2026-07-08),
Express `5.2.1` (2025-12-01), Zod `4.5.4` (2026-08-29), `@types/node` `24.13.3`
(2026-07-08) e `@types/express` `5.0.6` (2025-12-01). Fontes:
[índice de distribuições Node.js](https://nodejs.org/dist/index.json),
[registro TypeScript](https://registry.npmjs.org/typescript),
[registro Express](https://registry.npmjs.org/express),
[registro Zod](https://registry.npmjs.org/zod),
[registro @types/node](https://registry.npmjs.org/@types/node) e
[registro @types/express](https://registry.npmjs.org/@types/express).

Node.js 24 está em Active LTS na data da consulta; o calendário prevê manutenção
a partir de 2026-10-20 e fim de suporte em 2028-04-30. As datas podem mudar.
Express 5 requer Node.js 18 ou superior e suporta a versão mais recente da linha.
O projeto utiliza a linha 24 LTS. Fontes:
[calendário Node.js](https://github.com/nodejs/Release),
[releases Node.js](https://nodejs.org/en/about/previous-releases) e
[suporte Express](https://expressjs.com/en/support/).

## Preparação registrada

Antes de 2025, o compilador TypeScript era implementado em TypeScript/JavaScript.
O TypeScript 7, lançado em julho de 2026, usa implementação nativa em Go, mantendo
`tsc`. A mudança busca reduzir o tempo de análise e compilação; a aplicação continua
escrita em TypeScript e compilada para JavaScript. O compilador local foi executado
nesta etapa. Fonte:
[anúncio oficial TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

A preparação inicial executou `npm install` com versões exatas em `package.json`:
82 pacotes instalados, `package-lock.json` gerado e zero vulnerabilidades informadas
pelo npm nessa execução. Esse resultado pontual não garante ausência de
vulnerabilidades. `npm ls` e a versão do compilador local foram conferidos.

Na etapa 2, `npm ci` foi executado com sucesso: 82 pacotes instalados, 83 auditados
e zero vulnerabilidades relatadas. O SHA-256 do lock permaneceu idêntico antes e
depois da reinstalação; o valor e os resultados estão na seção de execuções abaixo.

O exemplo de `npm run check:config` do README, com os três caminhos de diretórios,
foi executado na etapa 2 e retornou `0`, sem criar os diretórios informados ou
iniciar servidor.

## Verificações registradas no guia de testes

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

## Verificação documental da etapa 1

Procedimentos da revisão, sem dependências adicionais do projeto:

1. Conferir os 13 arquivos obrigatórios: `README.md`, `AGENTS.md` e os 11 documentos
   obrigatórios em `doc/`. Conferir também a cópia adicional `doc/ai/requirements.md`.
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
