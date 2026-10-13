# Arquivos e pastas

A API ainda não recebe requisições nem manipula arquivos. Este guia descreve as
regras previstas para essas operações. O comando de configuração já confere
caminhos absolutos e compara os caminhos informados, mas não examina o disco nem
verifica se uma pasta pode ser acessada.

Os parâmetros e as respostas de cada operação estão no [guia de rotas](endpoints.md).
Veja também os [erros](errors.md), a [configuração](configuration.md) e os
[testes](testing.md).

## Como escrever um caminho

A pasta compartilhada é a **raiz**. Todos os caminhos usados pela API partem dela,
usam `/` como separador e representam a própria raiz com `.`. Nas rotas de
recursos, o caminho vai no parâmetro `path` da URL. As ações de cópia e compactação
recebem os campos JSON descritos no [guia de rotas](endpoints.md).

Caminhos absolutos, segmentos `..`, bytes nulos e formatos ambíguos precisam ser
recusados antes da operação. Espaços que fazem parte de nomes são preservados.

As regras exatas de leitura e classificação dos caminhos ainda estão em
definição. A tabela considera uma única decodificação da URL: `%20`, por exemplo,
vira um espaço apenas nessa leitura. Campos JSON não passam por essa
decodificação. Também não há correção automática do caminho, remoção de espaços
com `trim`, expansão de `~` ou variáveis de ambiente, nem alteração da forma de
representar caracteres Unicode.

| Entrada após decodificar a URL | Resultado |
| --- | --- |
| `.`, `documentos`, `documentos/nota.txt` | Formato permitido; o arquivo ou a pasta ainda precisa ser verificado no disco |
| `documentos/ nota final.txt ` | Espaços preservados, inclusive no início e no fim do nome |
| String vazia, `documentos//nota.txt`, `documentos/`, `./documentos`, `documentos/./nota.txt` | `400 invalid_path` |
| Qualquer byte nulo ou barra invertida em um caminho relativo | `400 invalid_path` |
| Caminho absoluto POSIX, de unidade Windows ou UNC; qualquer segmento `..` | `403 path_forbidden` para cliente autenticado |
| `...`, `.oculto`, `relatorio%20final.txt` | Nomes literais permitidos; `%20` restante não é decodificado novamente |

Um caminho absoluto ou uma tentativa de sair da raiz é classificado antes de
verificar barras invertidas. Caminhos absolutos Windows são recusados na API,
assim como os absolutos Linux. Isso é diferente de configurar uma raiz local
com um caminho absoluto nativo no servidor Windows.

Alguns exemplos de codificação na URL:

- `path=documentos%2Fnota%20final.txt` representa `documentos/nota final.txt`.
- `path=%2E%2E%2Fsegredo` tenta sair da raiz e é recusado.
- `path=%252E%252E%252Fsegredo` representa o nome literal `%2E%2E%2Fsegredo`;
  não há uma segunda decodificação.
- Para escrever um sinal `+` no nome, use `%2B` na URL.

Use `URLSearchParams` ou `curl --data-urlencode` para montar parâmetros sem
precisar codificar cada caractere manualmente.

Ao renomear, `name` recebe um único nome não vazio. Ele não pode ser `.`, `..`
nem conter `/`, `\` ou bytes nulos. O campo `parentPath` segue as regras de
caminhos, inclusive o uso de `.`. Campo obrigatório ausente e caminho vazio são
erros diferentes. Tipos incorretos e campos desconhecidos também passam pela
[validação da requisição](errors.md).

## Nomes e informações dos arquivos

As plataformas alvo são Linux Mint, Ubuntu e Windows. Os nomes na API precisam
ser representáveis em UTF-8.
Espaços e diferenças entre maiúsculas e minúsculas são preservados quando o
sistema de arquivos permite. Nomes começando com ponto não são escondidos só por
esse motivo.

Nomes feitos de bytes que não formam UTF-8 válido ficam fora do formato da API.
As regras de nomes, maiúsculas, caminhos longos e arquivos abertos diferem entre
Linux e Windows. O destino deve detectar nomes incompatíveis e conflitos, sem
renomear silenciosamente ou revelar caminhos privados. Veja [Linux e Windows](platforms.md).
macOS não faz parte do alvo atual.

Nas respostas, `type` é `file` ou `directory`. O campo `size` informa o tamanho de
um arquivo em bytes e vale `null` para pastas; não há cálculo de tamanho recursivo.
`modifiedAt` usa o horário UTC. Ainda estão em definição o formato ISO 8601 com
milissegundos e sufixo `Z`, e o uso de `name: "."` para a raiz. O caminho da raiz
é sempre `path: "."`.
As respostas não incluem caminhos absolutos do servidor.

## Limites da pasta compartilhada

A inicialização precisa descobrir a localização real da raiz. Cada operação
confere origem, destino e as pastas entre eles e a raiz. Comparar apenas o início
de duas strings não basta para saber se um caminho está dentro de outro.

A raiz pode ser consultada, listada e compactada. Pedir a criação de `.` devolve
a pasta existente, sem apagar seu conteúdo. A raiz não pode ser excluída, movida,
renomeada ou usada como origem de uma cópia nesta versão.

A preparação da raiz ainda está em definição. O comportamento considerado exige
que ela já exista e seja uma pasta, evitando criar uma pasta errada por causa de
um erro de digitação. Seu caminho real seria resolvido antes de conferir a
separação dos diretórios privados. Um link no caminho escolhido pelo
administrador poderia determinar essa localização inicial, mas não liberaria
links dentro da raiz. As operações também precisariam detectar mudanças na
identidade da raiz que invalidassem essa configuração.

### Links e tipos de arquivo

Um link simbólico é uma referência para outro caminho. Nenhuma operação pode
seguir ou agir sobre esses links, mesmo que apontem para dentro da raiz. Isso
vale para links quebrados, pastas intermediárias e links encontrados durante
cópia, ZIP ou exclusão recursiva. A exclusão não abre uma exceção para remover
o próprio link.

No Windows, a verificação também precisa considerar junctions e outros reparse
points que redirecionem acesso. A proteção não pode depender apenas de uma
checagem de links feita como no Linux; os mecanismos por plataforma ainda
precisam ser definidos e verificados.

Os detalhes de verificação abaixo ainda estão em definição:

- Cada parte existente do caminho seria examinada sem seguir links, conferindo
  seu tipo e sua localização real. Um destino novo exigiria a conferência da
  pasta ancestral existente antes de criar as partes permitidas.
- Somente arquivos regulares e pastas seriam aceitos. Dispositivos, sockets,
  FIFOs e outros arquivos especiais receberiam `403 entry_forbidden`.
- A listagem inteira seria recusada com `403 entry_forbidden` se um filho fosse
  um link simbólico ou arquivo especial. A resposta não ocultaria esses itens
  nem criaria um terceiro valor de `type`.
- Arquivos com mais de um hard link detectável (`nlink > 1`) seriam recusados,
  inclusive em operações recursivas, com `403 entry_forbidden`. Um hard link é
  outro nome para o mesmo arquivo. Essa checagem reduz o risco de expor um arquivo que
  também tenha um nome fora da raiz, mas não impede que outro processo crie
  um link enquanto a operação ocorre.
- As operações ficariam em um único sistema de arquivos local; a passagem
  detectada para outro dispositivo resultaria em `409 cross_device_operation`.
  A comparação entre origem e destino também consideraria a identidade real das entradas, quando
  disponível, além dos nomes dos caminhos.

Essas verificações não detectam todas as montagens. Um *bind mount*, por exemplo,
pode mostrar a mesma pasta em outro caminho sem mudar seu dispositivo. O uso do
servidor pressupõe que programas não confiáveis não administrem montagens dentro
da raiz. A detecção adicional de montagens ainda está em definição; não há
isolamento de montagens implementado. `realpath` também não identifica de forma
única hard links ou bind mounts, como explica a
[documentação de arquivos do Node.js](https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisesrealpathpath-options).

### Pastas privadas

Estado do servidor, credenciais, chaves e staging precisam ficar fora da raiz
real e não podem ser alcançados por links ou outros caminhos configurados pelo
administrador. Staging é a área temporária usada para preparar arquivos antes
de colocá-los no destino.

A verificação física de sobreposição com o repositório e as pastas privadas ainda
está em definição. Ela precisa considerar os dois sentidos: tanto uma pasta
privada dentro da raiz quanto a raiz dentro de uma pasta privada podem expor
arquivos internos. Uma lista de nomes ocultos não oferece essa proteção. As
restrições das opções estão no [guia de configuração](configuration.md).

## O que cada operação faz

O [guia de rotas](endpoints.md) traz os parâmetros, respostas e exemplos completos.

| Operação | Comportamento e conflitos |
| --- | --- |
| Metadados | Consulta informações de arquivo regular ou pasta, inclusive a raiz; ausência resulta em `404` |
| Listagem | Mostra somente filhos imediatos, com pastas antes de arquivos, sem percorrer subpastas e sem paginação |
| Download | Envia somente arquivo regular, aos poucos, sem carregá-lo inteiro na memória; usa nome seguro em `Content-Disposition` e tipo de conteúdo apropriado ou `application/octet-stream`; uma pasta não vira ZIP automaticamente |
| Upload | Recebe exatamente uma parte de arquivo chamada `file`; `path` define o destino completo, cujo pai precisa existir; prepara o conteúdo em staging; cria com `201` ou substitui arquivo regular com `204`; pasta no destino resulta em `409` |
| Criação de pasta | Cria pais ausentes; nova pasta resulta em `201`; pasta já existente, inclusive `.`, resulta em `200` e mantém o conteúdo; arquivo em um componente necessário resulta em `409` |
| Exclusão | Exclui arquivo ou pasta, com ou sem conteúdo; percorre subpastas automaticamente, sem parâmetro `recursive`; mantém as restrições de caminhos e entradas; raiz proibida; sucesso `204`, ausência `404` |
| Renomeação e movimentação | Somente `parentPath` move mantendo o nome; somente `name` renomeia mantendo a pasta; ambos permitem mover e renomear juntos, com pai de destino existente; sem mudança, retorna `200`; não move a raiz nem uma pasta para dentro de si mesma |
| Cópia | Recebe o caminho final completo, com pai existente; não acrescenta o nome de origem automaticamente; não copia a raiz, uma entrada sobre si mesma ou uma pasta para dentro de si mesma; cria com `201`; substituição permitida de arquivo resulta em `200` |
| Compactação | Recebe somente pasta, inclusive a raiz; envia ZIP aos poucos, sem guardá-lo inteiro na memória; usa nomes relativos à pasta solicitada e preserva pastas vazias; não cria ZIP permanente nem tarefa persistente |

A ordem dos nomes na listagem ainda está em definição: comparação dos bytes
UTF-8, em ordem lexicográfica, diferenciando maiúsculas de minúsculas e sem
depender do idioma configurado no sistema.

### Substituir e repetir operações

Upload substitui o conteúdo do arquivo de destino. Para mover ou copiar sobre
um arquivo existente, é preciso informar `overwrite=true`; o padrão é `false`.
Somente um arquivo regular pode substituir outro arquivo regular. Não há
substituição de pastas nem junção de árvores de diretórios. O destino não é
removido antes de preparar a cópia, e uma pasta que contém a própria origem não
pode ser removida para abrir espaço.

`overwrite` trata apenas da autorização para substituir o arquivo que já está
no destino. Não é uma opção de bloqueio: leitura e edição por outros programas
durante envio, cópia e movimentação seguem a regra de acesso simultâneo abaixo.

Os códigos para algumas recusas ainda estão em definição: `403 entry_forbidden`
ao tentar modificar a raiz de forma proibida; `422 validation_failed` ao mover
uma pasta para dentro de si mesma ou copiar uma entrada sobre si mesma ou para
um descendente. Um PATCH que mantém o nome e a localização atuais retorna `200`
sem alteração.

Repetir a criação de uma pasta não esvazia seu conteúdo. Repetir um upload mantém
o conteúdo solicitado, embora informações como a data de modificação possam
mudar. Uma segunda exclusão pode retornar `404` depois do primeiro `204`.
Isso ainda é idempotência: repetir o pedido mantém o mesmo efeito final, mas não
precisa gerar a mesma resposta. Repetir uma cópia sem permitir substituição pode
encontrar o destino já criado e resultar em conflito.

## Preparar, salvar e limpar arquivos

Upload e cópia precisam preservar o destino anterior se algo falhar antes de
colocar o novo conteúdo no lugar. O arquivo é recebido ou preparado aos poucos
em staging privado, conferido por completo e só então publicado no destino.
Temporários não podem aparecer na listagem, no download, na cópia ou no ZIP da
pasta compartilhada.

Preservar o destino em uma falha significa que a operação não o substitui nem
o apaga antes da publicação. Isso não congela o conteúdo nem desfaz edições
realizadas por outros programas enquanto a operação estava em andamento.

Os detalhes dessa preparação ainda estão em definição: staging fora da raiz e
no mesmo sistema de arquivos do destino. No Linux, pastas de permissão `0700`
e arquivos `0600`; no Windows, ACLs que protejam o mesmo conjunto de dados.
Cada operação teria uma área exclusiva, com nome
imprevisível. Antes de publicar, seriam conferidos novamente origem, pai, tipo
de entrada e possíveis conflitos. Uma cópia de pasta seria montada inteira em
staging antes de receber o nome final, sem apagar o destino antecipadamente.

A operação do sistema usada para publicar o arquivo ainda não foi escolhida.
Conferir se um nome existe e depois renomear um arquivo não garante que outro
programa não crie algo nesse intervalo. Uma falha `EXDEV`, que indica a tentativa
de cruzar sistemas de arquivos, corresponde a `409 cross_device_operation`.
Movimentação não é substituída automaticamente por cópia seguida de exclusão.
Se o local configurado para staging impossibilitar a publicação, a preparação
precisa falhar com uma mensagem local sem dados sensíveis.

Se a conexão cair antes da publicação, a operação cancela as transferências,
descarta somente seus próprios temporários e mantém o destino anterior. Depois
da publicação, falhar ao entregar a resposta não desfaz o arquivo já salvo.

O encerramento normal espera ou cancela operações conforme a
[configuração](configuration.md). Uma queda abrupta pode deixar temporários.
Uma limpeza posterior só pode apagar áreas comprovadamente criadas pelo próprio
servidor, sem esvaziar pastas temporárias do administrador nem remover arquivos
de outras operações.

### Limites do ZIP

A quantidade de entradas e o volume do ZIP têm limites configuráveis. A forma
exata de contar ainda está em definição: cada arquivo e pasta descendente conta
como uma entrada, inclusive pastas vazias; a pasta solicitada funciona como o
contêiner e não conta novamente. O volume é a soma dos bytes lidos dos arquivos
antes da compressão, e não o tamanho final do ZIP.

Os limites precisam ser conferidos durante a leitura, mesmo que exista uma
estimativa anterior. Se o limite for excedido antes dos headers, a resposta é
`413 payload_too_large`. Depois de começar a resposta, a transferência é
interrompida, conforme o [guia de erros](errors.md). Staging eventualmente usado
precisa ser descartado em caso de sucesso, falha ou desconexão. A biblioteca de
ZIP e a forma de preparar o arquivo ainda não foram escolhidas.

## Operações ao mesmo tempo e falhas parciais

Durante envio, cópia e movimentação, a aplicação não deverá impor bloqueios
exclusivos que impeçam outros programas de ler ou editar os arquivos envolvidos.
Essa regra abrange a origem lida pelo programa remetente e, quando existente,
o destino no dispositivo que recebe a operação. Não exige que outros programas
fechem seus arquivos para iniciar uma tentativa, mas respeita permissões e
restrições de arquivos abertos impostas pelo sistema operacional.

Permitir edição durante a leitura significa que o conteúdo enviado ou copiado
pode conter partes lidas em momentos diferentes. Não há garantia de uma versão
fixa nem detecção garantida de toda alteração externa. Se o destino existente
for editado enquanto o upload ou a cópia é preparado, a publicação poderá
substituir também essas edições. Isso segue a substituição já prevista pelo PUT
de upload ou autorizada com `overwrite=true` na cópia e na movimentação; não
há mesclagem de conteúdo ou comparação de versões definida.

Staging continua privado. Um novo arquivo só aparece no destino depois da
publicação. Mover pode fazer o caminho antigo deixar de existir; a ausência de
bloqueio não promete manter esse caminho acessível nem conservar todas as formas
de acesso de um programa que já abriu o arquivo. Se o sistema recusar a operação,
a API deverá informar a falha sem forçar o desbloqueio ou encerrar outro programa.

O servidor usa um único processo, sem exigir múltiplos workers. A coordenação
das requisições da própria API ainda está em definição. Uma trava interna poderá
ordenar alterações conflitantes da API, mas não deverá ser convertida em bloqueio
do arquivo para outros programas. Sua granularidade e duração ainda não foram
escolhidas. Receber um upload em staging não altera seu destino antes da hora.

Usar Promises não faz as operações esperarem automaticamente umas pelas outras.
Entre conferir um caminho e usá-lo, outro programa pode alterá-lo. Abrir um
arquivo sem seguir o último link e conferir o arquivo já aberto reduz alguns
riscos, mas não protege todas as pastas anteriores. A
[documentação do Node.js](https://nodejs.org/docs/latest-v24.x/api/fs.html#promises-api)
explica essas limitações das operações assíncronas.

Não há garantia de uma visão congelada de toda a pasta durante a leitura,
isolamento completo de outros programas, transação que altere vários arquivos
de uma só vez ou preservação após queda de energia. Trocar um nome no mesmo
sistema de arquivos tem características diferentes de percorrer uma árvore;
as garantias exatas dependem da operação e da plataforma usadas e ainda precisam
ser verificadas.

| Situação | Limitação |
| --- | --- |
| Upload ou cópia falha antes de publicar | Destino anterior preservado; temporários próprios removidos quando o processo consegue executar a limpeza |
| Criação de várias pastas pais falha | Pais já criados podem permanecer; não é seguro remover pastas que possam ter recebido conteúdo |
| Exclusão recursiva falha | Algumas entradas podem já ter sido excluídas; não há desfazer automático nem lixeira |
| Download ou ZIP durante escrita externa | Não há uma visão congelada dos dados; falhas detectadas podem encerrar a transferência |
| Edição da origem durante envio ou cópia | Conteúdo pode refletir leituras de momentos diferentes; não há versão fixa garantida |
| Edição do destino antes da publicação | Substituição prevista no upload ou autorizada por `overwrite=true` pode substituir também as edições simultâneas |
| Movimentação com arquivo aberto | Sistema operacional pode recusar; caminho antigo pode deixar de existir após sucesso |
| Outro processo altera links, nomes ou montagens | A trava interna da aplicação não impede essas alterações |
| Falha após salvar o arquivo ou começar a resposta | Não há garantia de reversão; uma resposta já iniciada não pode ser trocada por JSON |

O administrador precisa controlar quem altera a raiz e as pastas acima dela.
O projeto não é uma barreira contra usuários locais mal-intencionados.
Sistemas de arquivos de rede, outras configurações de montagem e outras
plataformas precisam de verificações próprias antes de serem considerados
compatíveis.
