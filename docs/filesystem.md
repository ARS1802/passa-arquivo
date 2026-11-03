# Arquivos e pastas

A API já encaminha operações de arquivos a `fileService`, que usa `File` e
`Directory` para acessar o disco. Este guia descreve as regras implementadas
e os limites que continuam importantes, como concorrência com outros programas
e a validação nativa da implementação Windows, ainda pendente.

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

A tabela considera uma única decodificação da URL: `%20`, por exemplo,
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
`modifiedAt` usa o horário UTC em formato ISO 8601 com milissegundos e sufixo `Z`.
Para a raiz, o nome é `name: "."`. O caminho da raiz
é sempre `path: "."`.
As respostas não incluem caminhos absolutos do servidor.

## Limites da pasta compartilhada

A inicialização precisa descobrir a localização real da raiz. Cada operação
confere origem, destino e as pastas entre eles e a raiz. Comparar apenas o início
de duas strings não basta para saber se um caminho está dentro de outro.

A raiz pode ser consultada, listada e compactada. Pedir a criação de `.` devolve
a pasta existente, sem apagar seu conteúdo. A raiz não pode ser excluída, movida,
renomeada ou usada como origem de uma cópia nesta versão.

Uma raiz configurada explicitamente precisa existir e ser uma pasta. Quando
`PASSA_ROOT` é omitido, o controller cria uma pasta disponível no diretório do
usuário, como explicado em [Configuração](configuration.md).
`Directory.open` resolve a localização real antes de conferir a separação dos
diretórios privados. Um link no caminho escolhido pelo administrador pode
determinar essa localização inicial; isso não libera links dentro da raiz.
As operações conferem se a identidade da raiz mudou desde a abertura.

### Links e tipos de arquivo

Um link simbólico é uma referência para outro caminho. Nenhuma operação pode
seguir ou agir sobre esses links, mesmo que apontem para dentro da raiz. Isso
vale para links quebrados, pastas intermediárias e links encontrados durante
cópia, ZIP ou exclusão recursiva. A exclusão não abre uma exceção para remover
o próprio link.

No Windows, além da inspeção do Node.js, o model confere o atributo nativo
`ReparsePoint` e recusa junctions e outros itens com esse atributo. A execução
dessa proteção em Windows real ainda precisa ser validada. Os requisitos de
NTFS, PowerShell e ACLs estão em [Linux e Windows](platforms.md).

O model realiza as seguintes verificações:

- Cada parte existente do caminho é examinada sem seguir links, conferindo
  seu tipo e sua localização real. Um destino novo exige a conferência da
  pasta ancestral existente antes de criar as partes permitidas.
- Somente arquivos regulares e pastas são aceitos. Dispositivos, sockets,
  FIFOs e outros arquivos especiais recebem `403 entry_forbidden`.
- A listagem inteira é recusada com `403 entry_forbidden` se um filho for
  um link simbólico ou arquivo especial. A resposta não oculta esses itens
  nem cria um terceiro valor de `type`.
- Arquivos com mais de um hard link detectável (`nlink > 1`) são recusados,
  inclusive em operações recursivas, com `403 entry_forbidden`. Um hard link é
  outro nome para o mesmo arquivo. Essa checagem reduz o risco de expor um arquivo que
  também tenha um nome fora da raiz, mas não impede que outro processo crie
  um link enquanto a operação ocorre.
- As operações ficam em um único sistema de arquivos local; a passagem
  detectada para outro dispositivo resulta em `409 cross_device_operation`.
  A comparação entre origem e destino também considera a identidade real das entradas, quando
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

A verificação física de sobreposição com o repositório e as pastas privadas
considera os dois sentidos: tanto uma pasta
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

A listagem ordena os nomes pelos bytes UTF-8, diferenciando maiúsculas de
minúsculas e sem depender do idioma configurado no sistema. Pastas aparecem
antes dos arquivos.

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

Os códigos para essas recusas são `403 entry_forbidden`
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

Staging fica fora da raiz e precisa estar no mesmo sistema de arquivos do
destino. No Linux, usa pastas `0700` e arquivos `0600`. No Windows, usa uma ACL
exclusiva do usuário na raiz privada, herdada pelos arquivos e diretórios criados
nela. Essas permissões são conferidas antes de acessar as entradas.
Cada operação recebe uma pasta exclusiva, criada com `mkdtemp`. Antes de
publicar um arquivo, `File.write` confere novamente o destino e seu pai. Uma
cópia de pasta é montada inteira em staging antes de receber o nome final.

`File.write` publica arquivos novos com `link`, que falha se o nome já estiver
ocupado; quando a substituição é permitida, usa `rename`. A cópia de diretório
usa movimentação após conferir o destino. Conferir um nome e depois renomear
não impede que outro programa altere esse nome no intervalo; a aplicação não
promete isolamento completo dessas mudanças. Uma falha `EXDEV`, que indica a tentativa
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

A quantidade de entradas e o volume do ZIP têm limites configuráveis. Cada
arquivo e pasta descendente conta
como uma entrada, inclusive pastas vazias; a pasta solicitada funciona como o
contêiner e não conta novamente. O volume é a soma dos bytes lidos dos arquivos
antes da compressão, e não o tamanho final do ZIP.

Os limites precisam ser conferidos durante a leitura, mesmo que exista uma
estimativa anterior. Se o limite for excedido antes dos headers, a resposta é
`413 payload_too_large`. Depois de começar a resposta, a transferência é
interrompida, conforme o [guia de erros](errors.md). `Directory.archive` usa
`yazl` para gerar o ZIP por partes, sem arquivo permanente nem staging para o
resultado. Encerrar a saída também encerra as leituras ativas.

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
