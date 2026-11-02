# Testes

## Estado atual do model

A implementação do model requer testes antes de ser considerada validada.
`npm run build:backend` passou, mantendo a saída em `dist`. As verificações
diretas, executadas com `node --input-type=module` e código pela entrada padrão,
confirmaram metadados e leitura básica de um arquivo temporário.

A bateria parou ao usar `assert.rejects` para a exceção síncrona de
`Directory.file(".")`. A operação recusou a raiz com `entry_conflict`, mas a
asserção deveria usar `assert.throws`. O roteiro original ainda não foi corrigido
nem retomado naquele roteiro. ZIP, certificados e persistência ficaram sem
verificação naquela execução. As verificações posteriores de peers e conexão
estão registradas abaixo. Não foram criados arquivos de teste.

Na revisão de 2026-11-01, `npm run build:backend` e verificações focadas com
`node --input-type=module` passaram em Node.js 26.10.0. O código das verificações
foi enviado pela entrada padrão, em execução sequencial com interrupção na
primeira falha, usando somente uma pasta temporária exclusiva removida ao final.
Foram conferidos:

- Gravação de arquivo novo e sobrescrita, recusa de conflitos e links, limite de
  bytes e preservação do destino. Alterações no destino durante a leitura da
  fonte confirmaram que a existência é consultada novamente antes da publicação.
- Cópia iterativa de árvore com 24 níveis, ramos e pasta vazia; retorno `created`
  direto de `Directory.copy` e por `fileService.copy`; criação e substituição de
  arquivo; recusa de destino ocupado, descendente e link, com staging limpo.
- Movimentação para subpasta e raiz, renomeação com espaços e recusa de caminhos
  inválidos antes de `path.posix.join`; aceitação de Unicode válido e recusa de
  uma string com unidade substituta UTF-16 isolada.

Esses resultados cobrem os ajustes da revisão, sem validar todo o model, todas
as profundidades de árvore ou o funcionamento em Windows.

O `npm test` atual é um placeholder que termina com erro. Não há suíte de
configuração em `.test-build` nem scripts `check` ou
`typecheck` no manifesto atual. Os cenários de cobertura futura continuam
sendo referências para o QA.

Os testes deverão conferir as opções de configuração, o comportamento da API,
as operações de arquivos, o pareamento e a comunicação entre GUI e controller.
A matriz de verificação deve incluir Linux Mint, Ubuntu e Windows, além das
conexões HTTP protegidas por TLS entre peers.

## Executar as verificações

### Revisão de legibilidade — 2026-11-02

A revisão partiu do commit `5993a09`, com a árvore de trabalho limpa. O ambiente
usado foi Node.js 26.10.0 e npm 11.19.1. As alterações preservaram os contratos
públicos, os formatos de persistência e as verificações de segurança.

| Verificação executada da raiz | Resultado |
| --- | --- |
| `npm run build:backend` | Passou na referência inicial e após as alterações; saída mantida em `dist` na raiz. |
| `npm run build:gui` | Passou na referência inicial e após as alterações. |
| `npm run lint:gui` | Passou na referência inicial e após as alterações. |
| `node --input-type=module`, com verificadores pela entrada padrão | 60 verificações de model/HTTPS, 35 comparações com a versão anterior e 11 verificações adicionais de descoberta e falhas de pareamento passaram. |
| `git diff --check` | Passou após a revisão final dos arquivos. |

Os verificadores diretos não foram salvos como arquivos de teste. Usaram
diretórios temporários exclusivos, removidos ao final, e pararam na primeira
falha. A primeira tentativa do verificador de comparação teve um parêntese
excedente e não chegou a executar testes. Depois da correção, a checagem passou;
essa falha foi no verificador, sem demonstrar um defeito na aplicação.

Foram conferidos:

- Gravação com texto, bytes e fonte assíncrona; criação, sobrescrita, limite de
  bytes e preservação do destino anterior em falha.
- Cópia de arquivo e árvore, pasta vazia, ordenação por tipo e bytes UTF-8,
  movimentação, conflito, cancelamento e recusa de caminhos externos e links.
- CSV de peers com vírgulas, aspas e quebra de linha no apelido; preparação sem
  confiança, descarte, atualização de conexão e recusa de certificado inválido.
- As dez rotas de arquivos e saúde em HTTPS com TLS 1.3 e certificados
  temporários: sucesso integrado ao model, parâmetros repetidos, codificação
  inválida, entrada ausente, conflito e upload acima do limite. Clientes sem
  certificado ou com certificado desconhecido foram recusados. A validação TLS
  e a autenticação permaneceram ativas.
- Mesmos resultados e códigos de erro para 35 entradas de query e destinos de
  descoberta comparadas ao código do commit inicial. Na rede de loopback, foram
  conferidos anúncio válido, resposta inválida ou excedida, timeout, destino
  indisponível e cancelamento. Falhas de envio do pareamento não criaram confiança.

Uma inspeção dos comentários encontrou documentação e parâmetros nas 159 funções
e métodos nomeados dos arquivos TypeScript/JavaScript analisados; `App`, em JSX,
foi conferido separadamente. Os arquivos JavaScript e CSS gerados pela GUI
mantiveram os mesmos SHA-256 da referência inicial. Isso confirma que esses
artefatos não mudaram; não substitui uma conferência visual no navegador.

Não foram repetidos nesta revisão o pareamento completo entre computadores,
os testes em Windows ou o uso visual da GUI. Os resultados não comprovam todas
as combinações de concorrência, permissões, falhas de disco ou plataformas.
`npm test` continua sendo um placeholder e não foi apresentado como suíte aprovada.

### Roteiro manual essencial

Execute os comandos na raiz. Os dois últimos passos dependem de uma instalação
de teste com peer já pareado e de um cliente HTTPS que valide o certificado do
servidor e apresente seu próprio certificado e chave. Não use dados reais para
testar alterações de arquivos.

| Comando ou procedimento | Resultado esperado |
| --- | --- |
| `npm run build:backend` | Compilação sem erros, com `dist/controller/api/app.js`. |
| `npm run build:gui` e depois `npm run lint:gui` | Build e análise estática sem erros. |
| `npm run dev:gui`; abrir o endereço mostrado e clicar no contador | Contador incrementa; imagens, links e estilos da tela inicial continuam presentes. Não há chamadas de arquivos ao backend. |
| `npm run start:backend`; pelo cliente autenticado, consultar `GET /health` e `GET /api/v2/directories/entries?path=.` | Saúde e listagem retornam `200`, sem expor caminhos absolutos. |
| Consultar `/health` sem certificado; depois, autenticado, consultar `/api/v2/entries?path=a&path=b` | A primeira conexão é recusada; a segunda retorna `422 validation_failed` antes de acessar o disco. |

### Descoberta temporária: verificações executadas

Em 2026-11-01, a compilação com `npm run build:backend` e as verificações abaixo
passaram em Linux com Node.js 26.10.0. Os comandos partiram da raiz do repositório.
As verificações diretas usaram `node --input-type=module`, com o código enviado
pela entrada padrão, sem criar arquivos de teste. As identidades e os dados
usados nas conexões ficaram em pastas temporárias exclusivas, removidas ao final.
Não foram usados os arquivos compartilhados nem as chaves da instalação real.

| Verificação executada | Resultado observado |
| --- | --- |
| Endereços e limites | IPs repetidos foram removidos; CIDRs IPv4 foram expandidos; destinos fora da interface selecionada, formatos proibidos, CIDRs IPv6 e listas acima de 256 destinos foram recusados. |
| Dois processos com identidades distintas | A encontrou o anúncio de B por TLS 1.3; o próprio certificado foi excluído; host ausente foi informado como falha; outra busca simultânea foi recusada. Nenhum registro confiável foi criado em A ou B. |
| Entrada temporária | `GET /connect` respondeu `200`; query desconhecida respondeu `422 validation_failed`; uma rota de arquivos respondeu `404`; cliente sem certificado teve a conexão encerrada. O cliente de teste validou o certificado do servidor com a identidade temporária esperada. |
| Concorrência e respostas inválidas | Dez destinos foram consultados com máximo observado de oito tentativas simultâneas. JSON inválido, certificado anunciado diferente do apresentado no TLS e anúncio maior que 16 KiB foram recusados. Um destino proibido invalidou a busca antes de qualquer conexão. |
| Prazos e encerramento | Servidor sem resposta produziu `timeout` após dois segundos; fechar a janela cancelou uma tentativa ativa. Um relógio controlado avançou 120 segundos e confirmou o fechamento do listener e a liberação da porta 8444. |

As conexões reais foram feitas entre processos no mesmo computador, usando
endereços de loopback. Isso não valida comunicação entre computadores, firewall,
IPv6 link-local ou funcionamento nativo no Windows. Naquela execução não houve teste de pareamento; as verificações do fluxo com
impressões digitais completas estão registradas na seção correspondente abaixo.

### Roteiro essencial para repetir a descoberta

1. Na raiz, execute `npm run build:backend`. Resultado esperado: término com
   código zero e JavaScript gerado em `dist`.
2. Em duas instalações de teste, inicialize o model no processo de cada
   controller e chame `openDiscovery` com o IP local e o nome da interface real.
   Siga o [exemplo de chamada](connection.md#exemplo-de-chamada-pelo-controller),
   substituindo `192.168.1.20`, `192.168.1.35` e `wlp2s0` pelos valores da rede.
   Em A, chame `discover({ addresses: [IP_DE_B] })`. Resultado esperado: B aparece
   como candidato; as listas retornadas por `listPeers()` continuam sem novos
   registros. A abertura precisa ocorrer no mesmo processo que inicializou o
   model; iniciar apenas `npm run start:backend` não abre a descoberta.
3. Nesse processo de A, chame `discover({ addresses: ["localhost"] })` e confira
   a rejeição `validation_failed`. Depois, consulte B com um certificado de
   cliente de teste e envie `GET /connect?extra=1`: espere `422 validation_failed`.
4. Com a janela aberta, use um cliente de teste que valide o certificado de B:
   sem certificado de cliente, `GET /connect` deve ter a conexão encerrada;
   apresentando o certificado de A, `GET /api/v2/entries?path=.` deve retornar
   `404`. Não desative a validação TLS do cliente para repetir essa verificação.
5. Em B, chame `closeDiscovery()` e, em A, repita a busca. Resultado esperado:
   B não aparece e seu destino consta como falha. Reabra a janela de B, aguarde
   120 segundos e repita para conferir o encerramento pelo prazo.

Os passos entre instalações são procedimentos manuais sugeridos. Os resultados
efetivamente executados nesta entrega estão na tabela acima. Ainda não existe
comando da GUI nem rota HTTP para abrir a descoberta remotamente.

### Pedidos locais de pareamento: verificações executadas

Em 2026-11-01, `npm run build:backend` e verificações diretas com
`node --input-type=module` passaram em Linux com Node.js 26.10.0. O código foi
enviado pela entrada padrão, com interrupção na primeira falha e sem criar
arquivos de teste. Duas identidades foram preparadas pelo model em uma pasta
temporária exclusiva, removida ao final. Foram conferidos:

- Criação de sessão com os dois certificados, deduplicação inclusive em chamadas
  concorrentes e cópias de consulta que não alteram os dados internos.
- Recusa de descoberta desligada, DNS, IP fora da interface selecionada, nome
  Unicode inválido, certificado inválido ou expirado e identidade da própria instalação.
- Recusa e cancelamento idempotentes, preservação da razão de encerramento,
  identificador desconhecido e descarte de sessões anteriores ao criar um pedido
  em uma nova janela.
- Cancelamento ao fechar a descoberta, inclusive durante uma criação assíncrona.
  Um relógio controlado confirmou que um pedido criado após 60 segundos expira
  nos 60 segundos restantes da janela de 120 segundos.
- Preservação do índice e do conteúdo da área de peers de teste de A; nenhum
  peer confiável criado em A ou B e nenhuma chave privada nas consultas de pedidos.

Essas verificações cobrem o controle local dos pedidos. Naquela execução não houve teste de mensagens entre computadores. As verificações
posteriores do fluxo completo estão registradas abaixo; a confirmação atual usa
impressões digitais completas, sem código curto.

Para repetir o roteiro essencial, a partir da raiz:

1. Execute `npm run build:backend`: deve terminar com código zero e saída em `dist`.
2. No processo de teste com model inicializado e descoberta aberta, chame
   `createPairingRequest(candidate)` duas vezes para o mesmo candidato válido:
   deve retornar o mesmo `id`, com estado `pending` e os dois certificados públicos.
3. Troque apenas o IP do candidato por `localhost`: a criação deve rejeitar com
   `validation_failed`. Usar o certificado da própria instalação deve rejeitar
   com `pairing_self`.
4. Recuse um pedido por `rejectPairingRequest(id)` e repita: ambos retornam
   `rejected`. Tentar cancelar esse pedido deve rejeitar com `pairing_request_closed`.
5. Crie outro pedido e feche a descoberta: o estado deve ser `cancelled`.
   Repita em outra janela e aguarde seu prazo terminar: o estado deve ser
   `expired`. `listPeers()` deve continuar sem novos registros confiáveis.

Nos procedimentos, `candidate` é um resultado de descoberta da instalação de
teste; seus IPs, certificados e caminhos pertencem ao ambiente de teste.
As funções de pedidos são importadas de `dist/controller/connection/paringService.js`
após a compilação. A inicialização do model e a ativação da descoberta precisam
acontecer nesse mesmo processo. O exemplo de uso está em
[Pedidos locais em memória](connection.md#pedidos-locais-em-memória).

### Pareamento entre controllers: verificações executadas

O fluxo com impressões digitais completas foi verificado em 2026-11-01, em Linux
com Node.js 26.10.0. A compilação e três scripts diretos, executados da raiz por
`node --input-type=module` com código pela entrada padrão, terminaram com código
zero. A execução foi sequencial, interrompendo na primeira asserção inesperada.
Não foram criados arquivos de teste nem instaladas ferramentas.

| Verificação executada | Resultado observado |
| --- | --- |
| Model e compatibilidade | Preparações ficaram ocultas das consultas e da autenticação; confirmação e descarte foram idempotentes; reinício removeu somente pendências; identidade e peers confiáveis foram preservados; CSV antigo foi lido e atualizado para sete colunas, preservando nomes com aspas e vírgulas. |
| Proteção da entrada temporária | Corpo com campo extra retornou `422`; um terceiro certificado tentou usar a sessão de A e recebeu `403`; cliente sem certificado foi recusado; uma rota de arquivos retornou `404`. Três comparações locais incorretas recusaram o pedido nos dois lados sem criar confiança. |
| Falha de gravação | Sem o aceite de B, a conclusão foi recusada. Retirar a permissão de escrita da pasta privada temporária de B provocou falha real na preparação; o erro chegou a A e nenhum lado passou a confiável. Restaurar a permissão e repetir a mesma sessão permitiu concluir. |
| Fluxo integrado e reinício | Dois processos com identidades distintas concluíram e gravaram um peer em `01` em cada instalação. O TLS foi recarregado sem reiniciar os servidores; `/health` respondeu `200` nos dois sentidos e metadados responderam `200`. Parâmetro obrigatório ausente retornou `422`, e certificado estranho e TLS 1.2 foram recusados. B foi encerrado e reiniciado por `npm run start:backend`, mantendo certificado e confiança persistida. |
| Encerramento e identidade | Cancelamento descartou uma preparação sem remover confiança; recusa e cancelamento repetidos conservaram o motivo. Um relógio controlado confirmou expiração na janela e recusa de aceite posterior. Substituir o servidor por outra identidade no mesmo IP falhou no TLS antes de qualquer pedido HTTP ou gravação de confiança. |

As instalações, raízes compartilhadas, arquivos e certificados de teste ficaram
em pastas temporárias exclusivas, removidas ao final. As conexões reais usaram
`127.0.0.1` e `127.0.0.2`, na interface de loopback identificada pelo sistema.
As impressões digitais de referência vieram das identidades das instalações por
um canal de controle de teste separado das mensagens HTTPS.

No teste do comando existente, `npm run start:backend` recebeu `PASSA_ROOT`,
`PASSA_STATE_DIR`, `PASSA_STAGING_DIR`, `PASSA_HOST` e `PASSA_PORT` referentes
exclusivamente à instalação temporária de B. Nenhum caminho privado ou arquivo
compartilhado da instalação real foi usado. A alteração de permissão foi somente
nessa pasta temporária e foi restaurada antes da remoção.

Esses resultados não verificam uma GUI, dois computadores físicos, firewall,
queda de energia durante publicação do CSV ou ACLs nativas do Windows. As
verificações anteriores do controle local e da descoberta permanecem registros
parciais; a seção atual acrescenta as mensagens reais e a persistência.
`npm test` continua sendo um placeholder e não foi apresentado como suíte aprovada.

### Roteiro essencial do fluxo completo

1. Da raiz, execute `npm run build:backend`. Espere término com código zero e
   saída em `dist`. Prepare duas instalações de teste com caminhos exclusivos,
   inicialize o backend e abra a descoberta em cada processo conforme
   [Conexão](connection.md#exemplo-entre-duas-instalações-de-teste).
2. Em A, envie `startPairingRequest(candidateB, displayName)`. Confira as impressões
   digitais completas por um canal independente, chame `acceptPairingRequest`
   localmente nos dois lados e `completePairingRequest` em A. Espere `confirmed`,
   um registro confiável em cada instalação e acesso mTLS a `/health` com `200`.
3. Em outra sessão, informe uma impressão digital errada três vezes por chamada
   local. Espere `fingerprint_mismatch` nas duas primeiras e recusa na terceira,
   sem novo peer confiável. Uma tentativa de usar a sessão com outro certificado
   de cliente deve produzir `403 pairing_peer_rejected`.
4. Somente em uma instalação descartável, provoque uma falha de escrita na área
   privada de B, tente concluir e restaure as permissões. Espere erro propagado,
   sem confiança automática. Repita a mesma sessão com a gravação restabelecida:
   espere conclusão sem duplicar o peer. Não faça isso em `model/peer` real.
5. Reinicie B por `npm run start:backend`, configurando os mesmos caminhos da
   instalação de teste por `PASSA_ROOT`, `PASSA_STATE_DIR`, `PASSA_STAGING_DIR`,
   seu IP real em `PASSA_HOST` e a porta em `PASSA_PORT`. Substitua esses valores
   pelos do ambiente de teste. Espere o mesmo certificado e autenticação do peer
   persistido; um certificado não pareado deve continuar recusado.

## Conferir alterações na documentação

A revisão de um guia deve confirmar que os caminhos de arquivos, links, nomes de
funções e comandos correspondem ao projeto. Os exemplos também precisam manter
blocos de código fechados, JSON válido e sintaxe de terminal correta.

Estes comandos ajudam a identificar arquivos alterados e problemas de espaços:

```sh
git status --short --branch
rg --files --hidden -g '!.git' -g '!node_modules' -g '!dist' -g '!.test-build'
git diff --check
```

`git diff --check` não inclui arquivos novos que ainda não foram adicionados ao
Git. Eles também precisam ser lidos na revisão. É possível conferir somente a
sintaxe de um exemplo shell com `sh -n`, sem executá-lo; isso não prova que seu
resultado esteja correto.

Ao revisar uma rota, compare seus parâmetros, respostas e exemplos com o código e
os testes correspondentes. Quando a funcionalidade ainda não existir, o guia deve
dizer isso de forma direta.

## Cobertura necessária

Os casos abaixo orientam uma futura suíte automatizada. Alguns já foram
conferidos diretamente nas execuções registradas acima; isso não substitui
verificações repetíveis de todos os cenários e plataformas.

### Acesso e caminhos

| Área | Casos necessários |
| --- | --- |
| Identidade local | Chaves distintas por instalação; persistência após reinício e atualização; ausência de chave privada no tráfego, nas respostas e nos logs. |
| Proteção das rotas | Peers desconhecidos não acessam arquivos nem `/health`; falta de certificado ou confiança causa recusa TLS antes do HTTP quando aplicável; contexto de pareamento isolado. |
| Caminhos recebidos | Raiz `.`, nomes com espaços e caracteres especiais, caminhos absolutos, `..`, bytes nulos, barras repetidas ou finais e campos inválidos; decodificação da URL somente uma vez. |
| Links e áreas privadas | Links no destino ou em pastas intermediárias, inclusive em operações recursivas; arquivos privados nunca acessíveis pela API. |

### Consulta e alteração de arquivos

| Área | Casos necessários |
| --- | --- |
| Saúde e metadados | Resposta mínima de saúde após autenticação; nomes de campos em camelCase; raiz sem caminho absoluto; `size: null` para pastas e tamanho em bytes para arquivos; datas UTC; `404` para item ausente. |
| Listagem | Apenas filhos imediatos; raiz como padrão; grupos e ordenação previsíveis; rejeição de arquivo onde se espera pasta; espaços, caracteres especiais e links. |
| Download | Bytes exatos de arquivo regular; cabeçalhos e nome seguros; envio por partes; falha antes ou depois dos cabeçalhos; liberação de recursos quando o cliente desconectar. |
| Criação de pastas | Pais ausentes; `201` com `Location` ao criar; `200` ao repetir sem mudar o conteúdo; raiz; conflito com arquivo; ausência de corpo na requisição. |
| Upload | Exatamente um campo de arquivo; rejeição de campos extras; destino definido por `path`; pais existentes; `201` com metadados e `Location` ao criar e `204` sem corpo ao substituir; conflito com pasta, tipo de conteúdo incorreto e limite de tamanho. |
| Falhas de upload | Interrupção, multipart inválido depois dos dados, limite excedido e falha ao colocar o arquivo pronto no destino; preservação do arquivo anterior e limpeza do staging; autenticação antes de receber todo o conteúdo. |
| Exclusão | Arquivo vazio ou com dados, pasta vazia e árvore com conteúdo usando somente `path`; parâmetro `recursive` rejeitado como desconhecido; raiz e entradas proibidas protegidas; `404` quando ausente; `204` sem corpo no sucesso; repetição; efeitos de uma falha após parte da exclusão. |
| Movimentação e renomeação | Apenas `parentPath` conserva o nome de arquivo ou pasta; apenas `name` conserva a pasta atual; ambos mudam nome e pasta; campo omitido e `null`; corpo vazio e campos extras; nome sem separadores; pai existente; pedido que mantém o destino; metadados finais; raiz protegida; conflito e `overwrite` somente para arquivo regular. |
| Destinos de movimento | Pasta movida para si ou para dentro de si; destino ancestral que contém a origem; links; erro `EXDEV` entre sistemas de arquivos sem trocar a operação por cópia e exclusão. |
| Cópia | Arquivo e árvore de pastas; destino final completo e pai existente; rejeição de origem igual ao destino, raiz ou destino dentro da origem; ausência de mistura com árvore existente; substituição somente de arquivos; `201` ou `200`, com `Location` ao criar. |
| Falhas de cópia | Links e arquivos especiais na árvore; erros de leitura ou de colocação no destino sem alterar o destino anterior; conflitos; limpeza somente dos temporários da própria operação. |
| Acesso durante envio, cópia e movimentação | Outro processo tenta ler e editar origem e destino existente durante a operação; a aplicação não impõe bloqueio exclusivo; conferir separadamente restrições nativas; novo destino só aparece após publicação; movimentação pode remover o caminho antigo. |
| Edições simultâneas e substituição | Não exigir uma versão fixa quando a origem muda; destino editado durante preparação pode ser substituído pelo upload ou por cópia com `overwrite=true`; substituir outro arquivo em cópia ou movimentação exige essa autorização, independentemente de estar aberto; PATCH que mantém o próprio caminho continua sem alteração; falha anterior à publicação não desfaz edições externas. |
| ZIP | Corpo JSON obrigatório; `path` padrão `.`; origem precisa ser pasta; nomes relativos; pastas vazias; raiz; `Content-Type` e `Content-Disposition`; limites de entradas e bytes; ausência de caminhos absolutos, privados ou que escapem da raiz. |
| Falhas e recursos do ZIP | Links na árvore; limite detectado antes da resposta; leitura por partes sem guardar o ZIP inteiro na memória; remoção dos temporários no sucesso, erro e desconexão. |

### HTTP, navegador e encerramento

| Área | Casos necessários |
| --- | --- |
| Conexão HTTP/mTLS | A e B conferem certificados e posse de chave nos dois sentidos; recusa de peer não confirmado; versão mínima de TLS; nenhum protocolo alternativo. |
| Certificados | Identidade persistente, correspondência de chave, validade, perfil de nomes e pinning; mudança de IP não troca certificado; renovação não herda confiança sem procedimento explícito. |
| Interface local e CORS | Controle local protegido; página externa não inicia varredura nem confirma pedidos; CORS não substitui autenticação e não ultrapassa a verificação TLS; contrato local ainda em definição. |
| Inicialização e encerramento | Opções, chave ou certificado inválidos e porta ocupada impedem o servidor de ficar pronto; nenhuma mudança automática no sistema; encerramento libera os recursos do processo. |
| Uso completo | Comando de início abre HTTP; exemplos funcionam com a validação de identidade documentada; respostas coincidem com os guias; segredos ficam fora do Git e da raiz compartilhada. |

## Pareamento e persistência

Esses casos precisarão ser verificados com o protocolo escolhido, não apenas
com simulações de mensagens de sucesso:

| Assunto | Casos necessários |
| --- | --- |
| Descoberta | Ambos ativam; um lado desligado não aparece; cancelamento, tempo máximo, várias interfaces, redes sobrepostas e limites de destinos/concorrência. |
| Controle da varredura | Candidato remoto não pode escolher redes, disparar buscas ou aceitar a si mesmo; somente destinos locais explicitamente permitidos. |
| Conferência de certificado | Impressão digital completa correta, erro, expiração, tentativas limitadas e sessões simultâneas; aceite de uma sessão não autoriza outra. |
| Intermediário | Troca de certificado de A ou B, retransmissão de mensagens e substituição da sessão não concluem confiança. |
| Certificado anexado | Precisa corresponder ao participante que prova posse de chave no pareamento; um PEM copiado não basta. |
| Confirmação bilateral | Ambos salvam; queda de conexão e falha de gravação em apenas um lado não produzem falso sucesso nem acesso precoce aos arquivos. |
| Registro | Nome, certificado, primeira e última conexão persistem; descoberta e erros não atualizam a última conexão confiável; repetições não criam duplicatas. |
| Mudança de endereço | Mesmo certificado em novo IP continua reconhecido; certificado diferente no mesmo IP não herda confiança. |
| Ciclo da identidade | Reinício mantém confiança; troca, expiração, perda ou retirada de confiança têm comportamento explícito; sessões abertas e retomadas TLS precisam respeitar a política. |

## Linux e Windows

A verificação futura deverá usar instalações nativas de Linux Mint, Ubuntu e
Windows, com conexões Linux↔Linux, Linux↔Windows e Windows↔Windows. Rodar somente
em WSL não comprova suporte nativo a Windows.

Além de pareamento e transferências, conferir nomes reservados, conflitos de
maiúsculas, caracteres inválidos, caminhos longos, arquivos abertos, volumes,
links, junctions/reparse points, permissões POSIX e ACLs. O controle de encerramento
deve funcionar pelos mecanismos da aplicação e do sistema, sem depender apenas
de sinais POSIX. Os requisitos estão em [Linux e Windows](platforms.md).

## Cuidados ao escrever novos testes

Use pastas, certificados e credenciais temporários exclusivos. Nunca use arquivos
reais do operador. Para conferir uma operação que pode falhar, compare o conteúdo
antes e depois: apenas verificar que uma função foi chamada não prova que o
arquivo anterior ficou intacto ou que os temporários foram removidos.

Para cada rota, cubra método, tipo de conteúdo, cabeçalhos, campos obrigatórios,
valores padrão, campos desconhecidos, JSON malformado e valores inválidos. Nas
rotas com corpo JSON, inclua `413 payload_too_large` ao ultrapassar
`PASSA_JSON_MAX_BYTES`, mesmo sem `Content-Length`.

Respostas de erro devem usar `application/problem+json`, com status e código
coerentes e sem caminhos absolutos, rastros internos de erro ou segredos.
Respostas `204` não podem ter corpo.

Os testes de caminhos devem verificar origem, destino e pastas intermediárias,
inclusive dentro de árvores. Comparar apenas prefixos de textos não comprova que
um arquivo está dentro da raiz compartilhada.

Ao testar operações simultâneas, explique o alcance do teste. Um bloqueio interno
da aplicação não controla mudanças feitas por outros processos nem comprova
segurança para todas as montagens de disco.

Requisições podem ser testadas internamente, sem abrir uma porta de rede. Isso não
substitui os testes com conexões TLS reais e não cria um modo normal de execução
por HTTP. Se um caso não puder ser executado no ambiente disponível, ele continua
sem verificação; um teste ignorado não equivale a um teste que passou.
