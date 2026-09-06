Você está em um repositório inicialmente vazio. Sua tarefa é implementar a nova versão de uma API para administrar uma pasta compartilhada em rede local por HTTPS.

Este documento define o objetivo, o escopo inicial, o contrato da API, as regras de documentação e a forma como você deve conduzir a implementação durante nossa conversa.

Considere os requisitos abaixo obrigatórios. Não trate exemplos como autorização para expandir o escopo.


1. OBJETIVO DO PROJETO

Construir uma API que permita a clientes autorizados administrar arquivos e diretórios de uma única pasta local configurável.

O fluxo conceitual é:

Cliente
→ conexão HTTPS
→ autenticação
→ validação da requisição
→ resolução segura do caminho
→ operação no sistema de arquivos
→ resposta HTTP

A API deve ser predominantemente orientada a recursos, utilizando métodos HTTP de acordo com suas responsabilidades.

Cópia e compactação serão expostas como ações RPC específicas por simplicidade do escopo inicial.

Não existe obrigação de preservar as rotas ou os formatos da implementação anterior.

Não implemente compatibilidade com uma API antiga sem solicitação.


2. IMPLEMENTAÇÃO EM ETAPAS, PERGUNTAS E AUTORIZAÇÃO DE CONTINUIDADE

Toda implementação que eu solicitar deve ser dividida em etapas pequenas, coerentes e verificáveis.

Essa regra vale para criação de funcionalidades, correções, refatorações e alterações de comportamento.

Não agrupe toda a implementação em uma única etapa para evitar as pausas.

Você deve distinguir:

A. Implementação de uma etapa em andamento.
B. Etapa interrompida por uma pergunta.
C. Etapa concluída, aguardando autorização para a seguinte.
D. Conversa explicativa sem implementação pendente.


2.1. PLANEJAMENTO E PRIMEIRA ETAPA

Antes de iniciar uma implementação:

- Apresente as etapas propostas.
- Informe o objetivo e o resultado esperado de cada etapa.
- Indique os testes e documentos pertinentes.
- Identifique decisões essenciais ainda pendentes.

Ao iniciar a primeira etapa, registre o planejamento em doc/progress.md.

Meu pedido inicial autoriza executar somente a primeira etapa apresentada, desde que não existam decisões essenciais pendentes nem uma pausa vigente.

Uma etapa pode incluir código, testes e documentação relacionados ao seu objetivo.

Não considere a etapa concluída deixando sua documentação ou verificação para depois.

Não peça autorização adicional para executar ações que pertençam à etapa já autorizada.


2.2. PAUSA OBRIGATÓRIA ENTRE ETAPAS

Ao concluir uma etapa:

1. Informe o que foi implementado.
2. Informe o que foi verificado e os resultados.
3. Atualize a documentação pertinente.
4. Registre o estado e a próxima etapa em doc/progress.md.
5. Encerre a execução e aguarde meu “continuar”.

Não inicie a etapa seguinte automaticamente.

Não antecipe código, testes, instalações, refatorações ou preparações pertencentes à próxima etapa enquanto aguarda.

A ausência de perguntas, o tempo decorrido ou uma resposta como “entendi”, “certo” ou “obrigado” não autorizam avançar.

A existência de trabalho pendente não elimina a obrigação de parar entre etapas.


2.3. PERGUNTAS DURANTE UMA ETAPA

Posso fazer perguntas a qualquer momento, inclusive enquanto você implementa.

Quando isso acontecer:

- Interrompa a implementação assim que receber a pergunta.
- Encerre com segurança apenas uma operação indivisível já iniciada.
- Não termine a funcionalidade inteira antes de responder.
- Não comece novas alterações, instalações, refatorações ou testes.
- Suspenda também agentes auxiliares e tarefas de implementação em segundo plano.
- Registre o ponto de interrupção em doc/progress.md.
- Responda à pergunta objetivamente.
- Aguarde meu “continuar” antes de retomar qualquer implementação.

Uma pergunta não cancela a etapa, mas suspende sua execução.

Responder à pergunta não autoriza retomar automaticamente.

Novas perguntas mantêm a implementação pausada.


2.4. SIGNIFICADO DE “CONTINUAR”

Cada autorização explícita “continuar” permite somente:

- Retomar o restante da etapa interrompida; OU
- Iniciar a próxima etapa, caso a anterior já esteja concluída.

Ao concluir essa etapa, você deve parar novamente.

Uma autorização nunca libera todas as etapas restantes.

Se eu autorizar retomar uma etapa interrompida, essa autorização não permite iniciar também a seguinte.

Exemplo:

- Você está implementando a etapa 3.
- Eu faço uma pergunta.
- Você pausa e responde.
- Eu digo “continuar”.
- Você conclui somente a etapa 3.
- Você aguarda outro “continuar” para iniciar a etapa 4.

A palavra “continuar” dentro de uma pergunta, citação ou exemplo não constitui autorização por si só.


2.5. COMPORTAMENTO DURANTE A ESPERA

Enquanto aguarda:

- Responda às minhas perguntas.
- Faça somente leituras necessárias para fundamentar as respostas.
- Atualize documentação quando houver decisões explícitas, correções ou esclarecimentos relevantes.
- Não altere código, testes, dependências ou configuração executável.
- Não implemente alternativas apenas porque foram discutidas.

Uma nova decisão pode alterar o planejamento, mas não elimina a necessidade de aguardar “continuar”.

Distinga proposta, decisão aprovada e comportamento implementado.

Quando não houver implementação pendente:

- Responda normalmente às perguntas.
- Não exija “continuar” para conversar.
- Não transforme perguntas conceituais em pedidos de implementação.

Se eu cancelar, substituir ou redefinir explicitamente uma tarefa, siga a nova instrução, mantendo a divisão em etapas para qualquer nova implementação.


2.6. REGISTRO E RETOMADA

doc/progress.md deve indicar:

- Etapa atual.
- Trabalho concluído.
- Trabalho restante.
- Verificações executadas.
- Decisões pendentes.
- Motivo da pausa.
- Próxima ação autorizável.
- Estado explícito: aguardando “continuar”, quando aplicável.

Antes de retomar:

- Consulte esse registro.
- Consulte os documentos relacionados.
- Considere as decisões tomadas durante as perguntas.
- Retome do ponto registrado.

Não repita trabalho concluído.

Não avance além da etapa autorizada.

Registre essas regras também em AGENTS.md, para que persistam durante todo o desenvolvimento.


3. PRIMEIRA AÇÃO E DEFINIÇÃO TECNOLÓGICA

Antes de escrever código:

1. Inspecione o diretório atual.
2. Leia instruções locais existentes.
3. Confirme quais arquivos já existem e preserve trabalhos anteriores.
4. Verifique se linguagem e framework foram definidos na conversa.

Se linguagem e framework ainda não estiverem definidos, faça uma pergunta objetiva para obter essa definição antes de criar a implementação.

Não assuma que Python, FastAPI, TypeScript, Java, Go ou qualquer outra tecnologia foi escolhida.

Após a escolha:

- Utilize uma versão estável e suportada do runtime.
- Consulte a documentação oficial das APIs e bibliotecas relevantes.
- Registre versões e comandos de instalação.
- Utilize o mecanismo de lock de dependências apropriado.
- Separe dependências de execução e desenvolvimento quando a ferramenta permitir.
- Evite dependências experimentais ou desnecessárias.
- Não instale ferramentas globalmente nem altere o sistema operacional como efeito colateral.

Considere Linux como plataforma inicial de execução, salvo orientação contrária.

Não anuncie compatibilidade com Windows ou macOS sem verificação. Caso não sejam suportados nesta etapa, documente isso.

Após definir a tecnologia, execute somente a primeira etapa apresentada, respeitando eventuais pausas já vigentes.

Cada etapa posterior exige um novo “continuar”.

A definição da tecnologia não autoriza executar toda a implementação de uma vez.


4. ESCOPO INICIAL

Implemente somente:

- Verificação de saúde.
- Consulta de metadados de arquivo ou diretório.
- Listagem de diretório.
- Download de arquivo.
- Upload de um arquivo por requisição.
- Criação de diretórios.
- Exclusão de arquivo ou diretório.
- Renomeação.
- Movimentação.
- Cópia.
- Download de um diretório compactado em ZIP.
- Autenticação por Bearer token.
- HTTPS.
- CORS configurável.
- Validação e isolamento de caminhos.
- Tratamento consistente de erros.
- Inicialização documentada.
- Testes automatizados.
- Documentação continuamente atualizada.

Não implemente nesta etapa:

- Interface gráfica ou frontend.
- Banco de dados.
- Cadastro de usuários.
- Perfis, grupos ou permissões individuais.
- OAuth, login social ou mTLS.
- Infraestrutura própria de certificadora.
- Instalação automática de certificados nos computadores clientes.
- Filas, jobs persistentes ou acompanhamento remoto de progresso.
- Upload resumível ou em múltiplas partes independentes.
- Sincronização entre máquinas.
- Versionamento do conteúdo dos arquivos.
- Lixeira, histórico ou auditoria avançada.
- Microserviços.
- Armazenamento em nuvem.
- Compatibilidade retroativa.
- Implantação pública na internet.

Não crie recursos futuros “para deixar preparado”.


5. DOCUMENTAÇÃO COMO PARTE DA IMPLEMENTAÇÃO

A documentação é um requisito funcional do trabalho.

Nenhuma etapa estará concluída enquanto código, testes e documentação descreverem comportamentos divergentes.

Crie uma pasta chamada doc diretamente na raiz do projeto. Trata-se de um diretório de documentação, não de outro repositório.

Estrutura documental obrigatória:

README.md
AGENTS.md
doc/
    README.md
    endpoints.md
    classes.md
    architecture.md
    filesystem.md
    security.md
    configuration.md
    errors.md
    testing.md
    decisions.md
    progress.md

Responsabilidades:

README.md:
- Objetivo do projeto.
- Funcionalidades disponíveis.
- Requisitos mínimos.
- Instalação e inicialização.
- Um exemplo mínimo de uso por HTTPS.
- Links para a documentação detalhada.
- Limitações essenciais para começar a usar.

Mantenha o README curto. Não coloque nele o catálogo completo de endpoints, classes, decisões ou testes.

AGENTS.md:
- Regras permanentes para agentes que trabalharem neste repositório.
- Obrigatoriedade de consultar a documentação.
- Obrigatoriedade de dividir implementações em etapas.
- Pausa obrigatória entre etapas.
- Pausa imediata quando eu fizer perguntas durante uma implementação.
- Retomada somente mediante “continuar”.
- Limite de uma etapa por autorização.
- Comandos essenciais de verificação ou referência ao documento correspondente.
- Links para doc/README.md e doc/progress.md.

doc/README.md:
- Índice da documentação.
- Descrição curta da responsabilidade de cada documento.
- Orientação sobre qual arquivo consultar para cada tipo de tarefa.

doc/architecture.md:
- Componentes e responsabilidades.
- Fluxo de requisição.
- Direção das dependências.
- Separação entre HTTP, autenticação, regras de arquivos e acesso ao filesystem.
- Justificativas arquiteturais efetivamente adotadas.

doc/filesystem.md:
- Convenção de caminhos.
- Política da raiz.
- Links simbólicos.
- Conflitos e sobrescrita.
- Comportamento de cada operação de arquivos.
- Temporários, concorrência e limites das garantias oferecidas.

doc/security.md:
- Autenticação.
- Armazenamento de tokens e chaves.
- HTTPS e validação de certificados.
- CORS.
- Limites de confiança e restrições de segurança.

doc/configuration.md:
- Todas as opções de configuração.
- Nome, tipo, padrão, obrigatoriedade e validação.
- Precedência entre argumentos e variáveis de ambiente.
- Inicialização e encerramento.
- Emissão, reaproveitamento e renovação de certificados.
- Sistemas operacionais efetivamente suportados.

doc/errors.md:
- Formato dos erros.
- Códigos HTTP.
- Códigos de erro da aplicação.
- Condições que produzem cada erro.
- Comportamento quando uma transferência já tiver começado.

doc/testing.md:
- Como executar os testes.
- O que cada conjunto verifica.
- Testes de integração HTTPS.
- Limitações de cobertura.
- Distinção entre testes executados e ainda não executados.

doc/decisions.md:
- Decisão.
- Contexto.
- Alternativas relevantes.
- Justificativa.
- Consequências.
- Estado: proposta, aprovada ou substituída.

doc/progress.md:
- Planejamento por etapas.
- Etapa atual.
- O que foi implementado e verificado.
- Pendências.
- Bloqueios.
- Próxima ação concreta.
- Registro de pausa.
- Indicação de espera por “continuar”.
- Escopo da próxima retomada.

Não transforme progress.md em uma transcrição da conversa.


5.1. REQUISITOS DE doc/endpoints.md

Documente todos os endpoints efetivamente expostos.

Para cada endpoint, registre:

- Identificador e finalidade.
- Classificação: recurso HTTP ou ação RPC.
- Método e rota exatos.
- Justificativa da nomenclatura.
- Autenticação necessária.
- Tecnologia utilizada para roteamento, validação e transferência.
- Arquivo e símbolo que implementam o handler.
- Serviço ou operação de aplicação chamado pelo handler.
- Parâmetros de rota, query, headers e corpo.
- Tipo, obrigatoriedade, padrão e restrições de cada campo.
- Content-Type aceito.
- Content-Type retornado.
- Esquema da resposta.
- Status de sucesso.
- Erros previstos e referência a errors.md.
- Regras para arquivos, diretórios, raiz e destinos existentes.
- Efeitos no sistema de arquivos.
- Comportamento quando a mesma requisição é repetida.
- Exemplo técnico executável.
- Um exemplo curto em linguagem humana.

Toda a documentação deve utilizar linguagem técnica, precisa e verificável.

Somente a seção “Exemplo em linguagem humana” deve utilizar uma explicação cotidiana.

Exemplo de linguagem humana:
“Você seleciona a pasta documentos e recebe a lista de arquivos que existem dentro dela.”

O exemplo não substitui o contrato técnico.

Não escreva apenas “recebe um caminho” ou “retorna um erro”. Especifique o campo, o tipo, a localização e a condição.

Caso exista OpenAPI, mantenha-o consistente com este documento. OpenAPI não substitui a documentação solicitada.


5.2. REQUISITOS DE doc/classes.md

Documente todas as classes de produção definidas pelo projeto.

Para cada classe, registre:

- Nome e responsabilidade.
- Arquivo em que está definida.
- Camada ou componente arquitetural.
- Forma de instanciação e ciclo de vida.
- Dependências recebidas.
- Atributos, incluindo tipo, finalidade, mutabilidade e possibilidade de ausência.
- Métodos, incluindo parâmetros, retorno, finalidade e efeitos colaterais.
- Erros ou exceções relevantes.
- Invariantes preservadas.
- Interfaces implementadas.
- Herança, composição e demais relacionamentos efetivamente existentes.
- Onde é utilizada.
- Como cada consumidor a utiliza, com referência ao arquivo e ao símbolo correspondente.

Não descreva relacionamentos genéricos como “usada pelo sistema”. Identifique os consumidores reais.

Não invente classes apenas para preencher esta documentação.

Se a linguagem ou arquitetura utilizar funções, módulos, estruturas ou interfaces no lugar de classes, mantenha o nome classes.md e documente essas unidades em seções equivalentes, explicando essa organização.

Não catalogue internamente todas as classes de bibliotecas externas. Documente o papel das dependências externas utilizadas pelo projeto.

Atualize referências ao mover, renomear ou remover símbolos.


5.3. CONSULTA E ATUALIZAÇÃO A CADA MENSAGEM

Antes de atender cada nova mensagem minha:

- Consulte as instruções locais.
- Consulte o README principal, o índice documental e progress.md.
- Leia os documentos pertinentes à pergunta ou alteração.
- Confira a implementação quando a resposta depender do comportamento real.

Após cada alteração:

- Atualize todos os documentos afetados.
- Corrija exemplos desatualizados.
- Atualize progress.md.
- Confira a consistência entre contrato, código e testes.

Após uma pergunta sem mudança de comportamento:

- Atualize documentação somente se houver uma decisão explícita, esclarecimento necessário ou correção factual.
- Não produza alterações artificiais apenas para modificar arquivos.
- Não converta hipóteses da conversa em requisitos aprovados.

Durante uma pausa, atualizações documentais não autorizam retomar implementação.

Marque claramente comportamentos planejados que ainda não estejam implementados.


6. ORGANIZAÇÃO INTERNA

Use uma estrutura simples e idiomática para a linguagem escolhida.

Separe responsabilidades suficientes para que:

- A camada HTTP trate requisições e respostas.
- A autenticação valide credenciais.
- A lógica de aplicação coordene as operações.
- O componente de caminhos estabeleça quais entradas são permitidas.
- O acesso ao filesystem execute leitura, escrita e movimentação.
- A configuração e o ciclo de vida preparem o servidor.
- O tratamento de erros traduza falhas para respostas HTTP.

Não concentre tudo em um único arquivo.

Não espalhe cada função pequena em um arquivo diferente sem necessidade.

Não importe tipos HTTP para todas as regras internas. Erros de filesystem e regras de negócio devem poder ser testados sem iniciar o servidor.

Utilize abstrações apenas quando houver responsabilidade ou variação concreta que as justifique.


7. CONVENÇÃO DE CAMINHOS

A API administra uma única raiz configurada pelo operador.

Os caminhos apresentados ao cliente são relativos a essa raiz:

- "." representa a raiz.
- "documentos" representa um diretório.
- "documentos/nota.txt" representa um arquivo.

Adote "/" como separador do contrato.

Para este MVP, transmita o caminho do recurso em query parameters nas rotas REST descritas abaixo. Isso permite tratar a raiz explicitamente e evita misturar segmentos de caminhos com sufixos de rotas.

O uso de query parameters para identificar recursos não transforma a operação em RPC.

Requisitos:

- Não aceite caminhos absolutos.
- Não aceite segmentos "..".
- Rejeite bytes nulos.
- Rejeite formatos ambíguos ou não suportados.
- Preserve espaços legítimos nos nomes; não remova espaços silenciosamente.
- Defina o tratamento de separadores repetidos e barras finais.
- Valide o caminho depois da decodificação normal da URL.
- Não aplique decodificações percentuais sucessivas.
- Não use comparação textual de prefixos como única proteção.
- Não exponha caminhos absolutos locais nas respostas.
- Utilize codificação correta de query parameters nos exemplos.
- Documente limitações de nomes impostas pelo sistema operacional.

Resolva a raiz efetiva durante a inicialização.

Para simplificar e tornar verificável a política inicial, não permita operações sobre links simbólicos nem travessia por eles dentro da raiz.

A regra inclui links encontrados durante cópia ou compactação recursiva.

Em plataformas suportadas que possuam junctions ou mecanismos equivalentes, trate-os explicitamente.

Não descreva uma validação de caminho como proteção absoluta contra alterações simultâneas feitas por outros processos.

Documente e teste as garantias realmente implementadas.


8. CONTRATO DA API

Utilize o prefixo /api/v2 para as funcionalidades de arquivos.

Adote camelCase nos campos JSON.

Endpoints obrigatórios:

GET    /health
GET    /api/v2/entries?path=...
GET    /api/v2/directories/entries?path=...
GET    /api/v2/files?path=...
PUT    /api/v2/files?path=...
PUT    /api/v2/directories?path=...
DELETE /api/v2/entries?path=...&recursive=false
PATCH  /api/v2/entries?path=...
POST   /api/v2/actions/copy
POST   /api/v2/actions/archive

As rotas actions/copy e actions/archive são ações RPC deliberadas.

As demais operações devem utilizar a identidade do recurso e a semântica do método HTTP.

Não afirme que cópia e compactação são impossíveis de modelar como recursos REST. A escolha por ações explícitas neste MVP busca simplicidade.


8.1. METADADOS

Defina uma representação comum de entrada:

{
  "name": "nota.txt",
  "path": "documentos/nota.txt",
  "type": "file",
  "size": 123,
  "modifiedAt": "2026-09-05T12:00:00Z"
}

Regras:

- type deve ser um valor enumerado: "file" ou "directory".
- size representa bytes para arquivos.
- Para diretórios, size deve ser null; não calcule tamanho recursivo implicitamente.
- modifiedAt deve usar uma representação temporal padronizada em UTC.
- path deve ser relativo à raiz.
- Para a raiz, utilize path "." e defina um nome estável sem revelar o caminho absoluto.


8.2. SAÚDE

GET /health

- Exige autenticação.
- Retorna 200 e um objeto mínimo como {"status":"ok"}.
- Não retorna tokens, caminhos absolutos ou configuração sensível.
- Não deve afirmar que todas as operações estão disponíveis sem realmente verificar isso.


8.3. CONSULTA DE METADADOS

GET /api/v2/entries?path=documentos/nota.txt

- path é obrigatório.
- Não recebe corpo.
- Retorna 200 com os metadados da entrada.
- Pode consultar a raiz com path ".".
- Retorna 404 quando a entrada não existe.


8.4. LISTAGEM

GET /api/v2/directories/entries?path=documentos

- path assume "." quando ausente.
- Não recebe corpo.
- Lista somente filhos imediatos.
- Ordena diretórios antes de arquivos e utiliza ordenação nominal determinística dentro dos grupos.
- Retorna 200 com:

{
  "path": "documentos",
  "entries": []
}

Os elementos de entries seguem a representação comum de metadados.

Não implemente listagem recursiva ou paginação nesta etapa.

Não exponha arquivos internos de configuração, credenciais ou staging.


8.5. DOWNLOAD

GET /api/v2/files?path=documentos/nota.txt

- path é obrigatório.
- Não recebe corpo.
- Aceita somente arquivo regular.
- Retorna os bytes com status 200.
- Utiliza Content-Disposition com nome seguro.
- Usa um Content-Type apropriado, com application/octet-stream como alternativa.
- Transfere em streaming, sem carregar o arquivo completo em memória.
- Não transforme diretórios em ZIP implicitamente.


8.6. UPLOAD

PUT /api/v2/files?path=documentos/nota.txt

Adote multipart/form-data com exatamente um campo de arquivo chamado file.

- path é obrigatório e representa o caminho final completo.
- O nome recebido na parte multipart não determina o destino.
- O diretório pai deve existir.
- Arquivo novo: 201, metadados e Location.
- Substituição de arquivo existente: 204, sem corpo.
- Se o destino for diretório: 409.
- A substituição do conteúdo de um arquivo existente é a semântica deliberada deste PUT.
- Não crie diretórios pais automaticamente neste endpoint.
- Rejeite campos ou arquivos inesperados.
- Defina e aplique um limite configurável de tamanho.

Receba o conteúdo por streaming em um local de staging privado.

Publique o novo conteúdo somente depois do recebimento completo e das validações necessárias.

Falha ou interrupção antes da publicação deve preservar o arquivo anterior.

FormData é a interface JavaScript que pode produzir o multipart. Ele não é uma arquitetura de API.

Nos exemplos de navegador, não defina manualmente Content-Type ao enviar FormData; o navegador deve gerar o boundary.


8.7. CRIAÇÃO DE DIRETÓRIO

PUT /api/v2/directories?path=documentos/projetos

- path é obrigatório.
- Não recebe corpo.
- Cria o diretório e pais ausentes.
- Diretório novo: 201 com metadados e Location.
- Diretório já existente: 200 com metadados, preservando seu conteúdo.
- Arquivo existente no caminho: 409.
- path "." retorna os metadados da raiz existente.

Não interprete a repetição desse PUT como pedido para esvaziar a pasta.


8.8. EXCLUSÃO

DELETE /api/v2/entries?path=documentos/nota.txt&recursive=false

- path é obrigatório.
- recursive é booleano e assume false.
- Não recebe corpo.
- Exclui arquivos e diretórios vazios.
- Diretório não vazio exige recursive=true.
- Sem essa autorização explícita, retorna 409.
- A raiz nunca pode ser excluída.
- Sucesso: 204, sem corpo.
- Entrada ausente: 404.

Documente que respostas diferentes ao repetir DELETE não significam, por si só, ausência de idempotência.


8.9. MOVIMENTAÇÃO E RENOMEAÇÃO

PATCH /api/v2/entries?path=documentos/nota.txt

Content-Type: application/json

{
  "name": "nota-final.txt",
  "parentPath": "documentos/finalizados",
  "overwrite": false
}

Regras:

- name e parentPath são opcionais, mas pelo menos um deve ser informado.
- name altera o nome.
- parentPath altera o diretório pai.
- A presença dos dois aplica uma única operação de mover e renomear.
- Campo omitido preserva o valor atual.
- null não equivale a campo omitido.
- overwrite assume false.
- name deve ser um único nome válido, sem separadores.
- parentPath deve identificar um diretório existente.
- Corpo vazio ou campos desconhecidos devem ser rejeitados.
- Sucesso: 200 com os metadados e o caminho resultantes.
- Se não houver mudança efetiva, retorna 200 sem alteração.
- Não permite mover ou renomear a raiz.
- Não permite mover diretório para dentro de si mesmo.
- Conflito sem overwrite: 409.

Neste MVP, overwrite pode substituir somente um arquivo regular por outro arquivo regular.

Não substitua nem mescle árvores de diretórios.

Se a plataforma não puder realizar a movimentação entre filesystems com as garantias implementadas, rejeite essa situação de forma documentada, em vez de executar silenciosamente uma cópia seguida de exclusão.


8.10. CÓPIA

POST /api/v2/actions/copy

Content-Type: application/json

{
  "sourcePath": "documentos/nota.txt",
  "targetPath": "backup/nota.txt",
  "overwrite": false
}

- sourcePath e targetPath são obrigatórios.
- targetPath é sempre o caminho final completo.
- Não acrescente automaticamente o nome da origem quando o destino for uma pasta.
- O diretório pai do destino deve existir.
- overwrite assume false.
- Copia arquivo ou árvore de diretório.
- Não permite copiar a raiz nesta etapa.
- Não permite origem e destino correspondentes à mesma entrada.
- Não permite copiar um diretório para dentro dele mesmo.
- Não mescla diretórios.
- Substituição permitida somente entre arquivos regulares.
- Criação: 201 com metadados e Location.
- Substituição permitida de arquivo: 200 com metadados.
- Conflito: 409.

Não remova previamente um destino existente para depois tentar copiá-lo.

Valide a política de links em toda a árvore.

Em caso de falha, preserve o destino anterior e remova somente staging criado pela própria operação.


8.11. COMPACTAÇÃO

POST /api/v2/actions/archive

Content-Type: application/json

{
  "path": "documentos"
}

- path assume "." quando omitido.
- Exige corpo JSON válido.
- Aceita somente diretório.
- Permite compactar a raiz.
- Retorna 200 com application/zip e Content-Disposition.
- As entradas do ZIP são relativas ao diretório solicitado.
- Preserve diretórios vazios.
- Não inclua caminhos absolutos, segmentos de escape ou arquivos internos do servidor.
- A política de links simbólicos também se aplica à compactação.
- Defina limites configuráveis para quantidade de entradas e volume processado.
- Não carregue o ZIP inteiro em memória.
- Remova temporários após sucesso, erro ou desconexão do cliente.

Não crie jobs persistentes, URLs de consulta de progresso ou arquivos ZIP permanentes.


9. REGRAS TRANSVERSAIS DE SISTEMA DE ARQUIVOS

- A raiz compartilhada não pode ser excluída, movida ou renomeada.
- Caminhos inválidos devem ser rejeitados antes da operação principal.
- A validação deve abranger origem, destino e componentes intermediários.
- Sobrescrita não significa mesclagem.
- Operações não podem remover um ancestral que contenha sua própria origem.
- Temporários e staging devem ficar inacessíveis pela API.
- Escolha o local de staging considerando o filesystem necessário para publicação segura.
- Não prometa atomicidade que a plataforma não oferece.
- Documente diferenças entre operações atômicas e operações recursivas que podem falhar parcialmente.
- Utilize recursos da plataforma para reduzir condições de corrida.
- Execute inicialmente em um único processo, sem exigir múltiplos workers.
- Não confunda exclusão mútua dentro da aplicação com proteção contra alterações feitas por outros processos.
- Nunca use a pasta real de arquivos do operador como diretório de testes.


10. AUTENTICAÇÃO

Utilize:

Authorization: Bearer TOKEN

Requisitos:

- Todas as operações de arquivos e /health exigem autenticação.
- Credenciais devem ser verificadas antes de executar operações.
- Quando possível, rejeite autenticação inválida antes de processar integralmente uploads.
- Tokens devem ser gerados por um gerador criptograficamente seguro.
- O comportamento padrão pode preservar 16 tokens temporários por execução.
- Tokens gerados automaticamente permanecem válidos durante o processo.
- Um reinício com nova geração invalida os anteriores.
- Permita configuração explícita de tokens para execução automatizada.
- Documente que tokens configurados externamente podem continuar iguais após reinício.
- Faça comparação apropriada para segredos.
- Não use tokens em URLs.
- Não registre tokens em logs de requisição.
- Não armazene tokens dentro da pasta compartilhada.
- Se existir um arquivo local de entrega dos tokens ao operador, mantenha-o em diretório privado, fora da raiz compartilhada e ignorado pelo Git.
- Todos os tokens têm as mesmas permissões nesta etapa.
- Não invente identificação pessoal baseada nos tokens.

Requisições sem credenciais válidas devem retornar 401 com WWW-Authenticate adequado.

Use 403 para operações proibidas ao cliente autenticado, como tentativa de escapar da raiz.

Não reproduza automaticamente a semântica de erros da versão antiga.


11. HTTPS, CERTIFICADOS E CORS

HTTPS é obrigatório no modo normal de execução.

- Configure o servidor para receber conexões TLS.
- Não implemente fallback automático para HTTP.
- Não abra um listener HTTP apenas para redirecionamento.
- Não exija mudanças nos handlers por causa do uso de HTTPS.
- Utilize TLS 1.2 ou superior, permitindo TLS 1.3 quando suportado.
- Falhas de chave, certificado ou configuração TLS devem impedir a inicialização.

Disponibilize dois modos de certificado:

A. Autoassinado para desenvolvimento em rede local:
- Gere certificado e chave na primeira preparação.
- Reaproveite os arquivos válidos.
- Inclua no SAN os IPs ou nomes configurados.
- Verifique validade temporal e correspondência com a chave.
- Regenere quando necessário segundo uma política documentada.
- Não gere novamente a cada requisição.

B. Certificado fornecido pelo operador:
- Aceite caminhos configuráveis para certificado/cadeia e chave.
- Não sobrescreva esses arquivos automaticamente.
- Permita que tenham sido emitidos por CA pública ou privada.
- Documente como carregar certificados renovados.

Não instale mkcert, step-ca ou uma CA pública obrigatoriamente.

Não instale raízes de confiança nos clientes como efeito colateral.

Documente explicitamente:

- Certificado público e chave privada têm papéis diferentes.
- TLS inclui negociação e proteção da conexão.
- O cliente valida o certificado apresentado pelo servidor.
- Clicar em “continuar” no aviso do navegador não assina o certificado.
- A confiança do navegador não autentica o usuário perante a API.
- CORS não valida certificados nem substitui autenticação.

CORS:

- Deve aceitar uma lista configurável de origens.
- Não libere todas as origens por padrão.
- Permita os métodos utilizados pelo contrato.
- Permita Authorization e os Content-Types necessários.
- Exponha Content-Disposition e Location quando necessários ao cliente web.
- Responda ao preflight sem exigir o Bearer token da operação.
- Continue exigindo token na requisição efetiva.
- Se houver suporte a HTML aberto por file://, trate Origin: null como opção explícita e documente suas implicações.

Use validação real de certificados nos exemplos e testes principais.

Exemplos com verificação desativada devem ser claramente identificados como diagnóstico de desenvolvimento, nunca como configuração padrão.


12. ERROS E VALIDAÇÃO

Adote um formato consistente baseado em application/problem+json.

Inclua:

- type: identificador estável do tipo de problema.
- title: descrição curta.
- status: código HTTP.
- detail: descrição da ocorrência.
- code: código estável da aplicação.

Quando necessário, acrescente uma lista estruturada de erros de campos.

Não exponha stack traces, tokens, chaves ou caminhos absolutos.

Defina e documente os casos aplicáveis de:

- 400: requisição malformada ou sintaxe de caminho inválida.
- 401: autenticação ausente ou inválida.
- 403: acesso proibido ou tentativa de escapar da raiz.
- 404: entrada ou diretório necessário inexistente.
- 409: conflito de destino, tipo incompatível ou diretório não vazio.
- 413: upload acima do limite.
- 415: Content-Type não suportado.
- 422: conteúdo estruturado que viola o esquema ou uma restrição semântica.
- 500: erro inesperado.
- 503: indisponibilidade temporária identificável, se efetivamente aplicável.

Centralize a tradução de erros.

Não crie códigos sem um caso concreto.

Mantenha respostas 204 sem corpo.

Se uma transferência falhar depois de os headers terem sido enviados, não tente substituir retroativamente a resposta por um JSON de erro.

Encerre a transferência, limpe recursos e registre a falha sem expor segredos.


13. CONFIGURAÇÃO E INICIALIZAÇÃO

A inicialização deve ser reproduzível e simples.

Documente configurações para:

- Raiz compartilhada.
- Endereço de escuta.
- Porta, com padrão 8443.
- IPs ou nomes utilizados no certificado.
- Modo e caminhos de TLS.
- Tokens.
- Origens CORS.
- Limites de upload e compactação.
- Diretórios privados de estado e temporários, quando necessários.

Defina uma precedência explícita entre configuração, ambiente e argumentos.

No startup:

1. Valide a configuração.
2. Resolva e prepare a raiz.
3. Prepare diretórios internos privados.
4. Valide ou prepare os certificados conforme o modo.
5. Prepare a autenticação.
6. Inicie a escuta HTTPS.
7. Informe que o servidor está pronto somente após a inicialização efetiva.

Uma checagem prévia de porta pode ajudar no diagnóstico, mas não elimina a necessidade de tratar falha real ao abrir a porta.

Não reinstale dependências indiscriminadamente a cada execução.

Diferencie preparação do ambiente de inicialização do servidor.

Não mate automaticamente processos que estejam usando a porta.

Não altere firewall, políticas do sistema ou instalações globais.


14. TESTES OBRIGATÓRIOS

Teste comportamento observável e regras relevantes, não apenas chamadas internas.

Inclua:

Autenticação:
- Token ausente.
- Token inválido.
- Token válido.
- Proteção de todas as rotas previstas.

Contrato:
- Métodos e formatos aceitos.
- Campos obrigatórios e desconhecidos.
- Defaults.
- Respostas e códigos HTTP.
- Consistência da representação de metadados.

Caminhos:
- Raiz.
- Caminhos relativos válidos.
- Traversal.
- Caminhos absolutos.
- Nulos.
- Caracteres especiais e espaços.
- Entradas codificadas na URL.
- Links simbólicos em caminhos diretos e dentro de árvores.
- Tentativas de atingir arquivos internos.

Operações:
- Listagem.
- Download.
- Criação e repetição da criação de diretório.
- Upload novo e substituição.
- Upload interrompido sem perda do arquivo anterior.
- Exclusão simples e recursiva.
- Proteção da raiz.
- Renomeação.
- Movimentação.
- Cópia.
- Conflitos.
- Diretório movido ou copiado para dentro de si.
- ZIP, inclusive diretórios vazios.
- Limpeza de temporários.

HTTPS e CORS:
- Conexão HTTPS real usando confiança configurada.
- Falha de validação para certificado ou identidade inadequados.
- Ausência de serviço HTTP de fallback.
- Preflight permitido para origem configurada.
- Ausência de autorização CORS para origem não permitida.

Utilize diretórios temporários e certificados exclusivos de teste.

Não execute operações sobre dados reais.

Não afirme que um teste passou sem executá-lo.

Se o ambiente impedir uma verificação, informe exatamente qual teste não foi executado e por quê.


15. SEQUÊNCIA DE IMPLEMENTAÇÃO

A sequência abaixo representa o planejamento, não uma autorização de execução contínua.

A pausa definida na seção 2 é obrigatória entre todas as etapas.

Após definir a tecnologia:

Etapa 1:
- Crie as instruções permanentes e a estrutura documental.
- Registre o contrato e as decisões iniciais como planejados.
- Registre as etapas em doc/progress.md.
- Verifique a consistência do planejamento.
- Pare e aguarde “continuar”.

Etapa 2:
- Prepare a estrutura mínima e a configuração.
- Implemente as verificações pertinentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 3:
- Implemente autenticação e caminhos seguros.
- Execute os testes correspondentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 4:
- Implemente saúde, metadados, listagem e download.
- Execute os testes correspondentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 5:
- Implemente criação de diretório e upload.
- Execute os testes correspondentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 6:
- Implemente exclusão, movimentação e renomeação.
- Execute os testes correspondentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 7:
- Implemente cópia e compactação.
- Execute os testes correspondentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 8:
- Integre e verifique HTTPS e CORS.
- Execute os testes correspondentes.
- Atualize a documentação.
- Pare e aguarde “continuar”.

Etapa 9:
- Faça a revisão cruzada de código, documentação e testes.
- Execute as verificações finais.
- Confira os critérios de conclusão.
- Apresente a entrega final e encerre a implementação.

Durante etapas intermediárias, testes internos podem utilizar o mecanismo de teste do framework sem conexão de rede.

Isso não autoriza disponibilizar um modo normal de execução inseguro por HTTP.

Atualize a documentação ao longo de cada etapa.

Não deixe segurança, testes e documentação como tarefas genéricas para o final.

Você pode propor subdivisões ou ajustes de ordem quando houver dependências reais, registrando o motivo.

Não utilize esses ajustes para eliminar pausas ou ampliar o escopo de uma autorização.

A regra de pausa por perguntas vale também no meio de qualquer uma dessas etapas.

Para implementações futuras, crie um novo planejamento proporcional ao pedido e aplique exatamente o mesmo mecanismo de autorização por etapa.


16. CRITÉRIOS DE CONCLUSÃO

A implementação inicial estará concluída somente quando:

- O comando documentado iniciar o servidor.
- A API responder por HTTPS.
- Todas as funcionalidades previstas estiverem implementadas.
- O contrato documentado corresponder ao comportamento real.
- Os testes disponíveis tiverem sido executados.
- Não houver bloqueios que impeçam as funcionalidades obrigatórias.
- Não houver segredos dentro da raiz compartilhada ou versionados.
- README.md estiver enxuto.
- doc/endpoints.md e doc/classes.md estiverem completos.
- Os demais documentos estiverem consistentes.
- Não houver funcionalidades futuras apresentadas como existentes.
- As etapas tiverem respeitado minhas autorizações de continuidade.

Não declare a implementação concluída apenas porque uma etapa foi concluída.

Na entrega final, informe objetivamente:

- O que foi implementado.
- Como iniciar.
- Como verificar.
- Quais testes foram executados.
- Quais limitações permanecem.

Se houver um bloqueio, registre-o e informe o que falta, sem apresentar o trabalho como concluído.

Durante explicações, considere que sou um estudante de Ciência da Computação com experiência júnior.

Explique primeiro o essencial e utilize exemplos concretos.

Na documentação técnica, preserve rigor terminológico. Reserve linguagem cotidiana para os exemplos explicitamente identificados.

Quando explicar uma tecnologia, forneça contexto histórico somente quando ele ajudar a compreender a decisão atual.

Não invente mudanças recentes nem prolongue respostas com histórico irrelevante.

Comece inspecionando o repositório e verificando se a escolha de linguagem e framework já foi informada.

Depois de resolvida essa definição, apresente o planejamento e execute somente a primeira etapa autorizada.

Ao encerrá-la, pare e aguarde meu “continuar”.