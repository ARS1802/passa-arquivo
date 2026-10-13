# Testes

Os testes disponíveis conferem as opções de configuração e o comportamento do
comando de terminal. Também verificam que criar a aplicação Express não abre uma
porta de rede. A API ainda não tem rotas, autenticação, operações de arquivos ou
conexões HTTPS para testar. O manifesto e os caminhos atuais ainda são
específicos de Linux. Os testes existentes não comprovam suporte a Windows,
TOFU, mTLS ou persistência de peers.

## Executar as verificações

Na raiz do projeto, use Node.js **24.19.0**, indicado em [.nvmrc](../.nvmrc), e
npm **11.17.0**. Se usa nvm e essa versão está instalada, selecione-a com `nvm use`.
Depois:

```sh
npm ci
npm run check
```

`npm ci` instala as dependências nas versões salvas no lock. Não é necessário
reinstalá-las a cada execução dos testes. `npm run check` confere os tipos, compila
o projeto e executa a suíte, nessa ordem.

Para executar somente uma dessas verificações:

```sh
npm run typecheck
npm run build
npm test
```

| Comando | O que verifica | Arquivos gerados |
| --- | --- | --- |
| `npm run typecheck` | Tipos do código de produção e dos testes. | Nenhum. |
| `npm run build` | Compilação dos arquivos de `src/`. | JavaScript e mapas de origem em `dist/`. |
| `npm test` | Compilação do código e dos testes, seguida da execução com `node --test`. | Arquivos em `.test-build/`. |

`dist/`, `.test-build/` e `node_modules/` são ignorados pelo Git. Eles não são pastas
de arquivos compartilhados. Os comandos e suas definições ficam no
[package.json](../package.json).

## O que os testes atuais cobrem

### Valores de configuração

[tests/config.test.ts](../tests/config.test.ts) chama `loadConfig` com argumentos
e variáveis de ambiente preparados para cada caso. Nenhum desses caminhos é
aberto no disco. O arquivo verifica:

- As três pastas obrigatórias, os valores padrão e as 16 opções por argumentos
  e variáveis de ambiente.
- A preferência de argumentos sobre variáveis e padrões, inclusive quando o
  valor substituído está inválido, e a substituição de listas inteiras.
- Argumentos desconhecidos, repetidos ou sem valor; variáveis `PASSA_`
  desconhecidas; números e listas JSON em formatos inválidos.
- Os menores e maiores valores numéricos permitidos e a rejeição de valores fora
  dos limites.
- Caminhos absolutos, simplificação de `.` e `..`, preservação de espaços e
  separação entre as pastas e os caminhos de certificado, chave e tokens.
- Os modos de certificado, os nomes e IPs do servidor, as identidades SAN e as
  origens CORS.
- A proteção do objeto de configuração e de suas listas contra alteração, sem
  modificar os dados recebidos.
- Mensagens de erro sem expor os valores privados usados nos testes.

### Comando de terminal e aplicação

[tests/bootstrap.test.ts](../tests/bootstrap.test.ts) inicia processos separados
para observar como o programa termina e o que escreve no terminal. Ele verifica:

- Configuração aceita com saída `0`, sem criar as pastas informadas e com mensagem
  clara de que não houve leitura de arquivos nem início de servidor.
- Configuração inválida com saída `2`, sem repetir valores privados ou caminhos.
- Opção desconhecida rejeitada sem publicar o nome ou o valor recebido.
- Importação da configuração e criação da aplicação Express sem abrir uma porta
  ou manter o processo ativo.

O teste de criação de pastas usa uma pasta temporária exclusiva e a remove ao
terminar. Os demais caminhos são somente textos de configuração. Nenhum teste
usa a pasta real de arquivos de quem executa o projeto ou gera tokens e
certificados de produção.

## O que esses testes não comprovam

Aceitar um caminho não prova que ele existe, pode ser acessado, pertence ao usuário
correto ou está separado fisicamente de outro caminho. Os testes atuais não
verificam permissões, links simbólicos, discos ou a localização real do repositório.

Da mesma forma, conferir um nome ou IP em `tls-sans` não testa uma conexão HTTPS.
Não há testes de certificados reais, confiança bilateral, mTLS, pareamento
ou transferências. O caminho de saída `1` da CLI para uma falha inesperada existe
no código, mas não tem um teste que provoque essa falha.

`npm test` executa apenas os arquivos de teste existentes. Um resultado sem falhas
não significa que toda a API esteja pronta.

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

## Cobertura necessária para as funcionalidades que faltam

Os casos abaixo ainda não têm testes implementados. Eles descrevem resultados
que precisarão ser conferidos junto das funcionalidades correspondentes.

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

### HTTPS, navegador e encerramento

| Área | Casos necessários |
| --- | --- |
| Conexão HTTPS/mTLS | A e B conferem certificados e posse de chave nos dois sentidos; recusa de peer não confirmado; versão mínima de TLS; nenhuma alternativa HTTP. |
| Certificados | Identidade persistente, correspondência de chave, validade, perfil de nomes e pinning; mudança de IP não troca certificado; renovação não herda confiança sem procedimento explícito. |
| Interface local e CORS | Controle local protegido; página externa não inicia varredura nem confirma pedidos; CORS não substitui autenticação e não ultrapassa a verificação TLS; contrato local ainda em definição. |
| Inicialização e encerramento | Opções, chave ou certificado inválidos e porta ocupada impedem o servidor de ficar pronto; nenhuma mudança automática no sistema; encerramento libera os recursos do processo. |
| Uso completo | Comando de início abre HTTPS; exemplos funcionam com validação do certificado; respostas coincidem com os guias; segredos ficam fora do Git e da raiz compartilhada. |

## Pareamento e persistência

Esses casos precisarão ser verificados com o protocolo escolhido, não apenas
com simulações de mensagens de sucesso:

| Assunto | Casos necessários |
| --- | --- |
| Descoberta | Ambos ativam; um lado desligado não aparece; cancelamento, tempo máximo, várias interfaces, redes sobrepostas e limites de destinos/concorrência. |
| Controle da varredura | Candidato remoto não pode escolher redes, disparar buscas ou aceitar a si mesmo; somente destinos locais explicitamente permitidos. |
| Código | Confirmação correta, erro, expiração, reutilização, tentativas limitadas e sessões simultâneas; código de uma tentativa não serve em outra. |
| Intermediário | Troca de certificado de A ou B, retransmissão de código/mensagens e substituição da sessão não concluem confiança. |
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
