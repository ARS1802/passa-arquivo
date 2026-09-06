# Segurança

**Estado:** autenticação, emissão de certificados, transporte e isolamento continuam planejados. A etapa 2 implementou somente validação local de opções, diagnósticos sanitizados, exclusões de arquivos no Git e uma fábrica Express sem rotas/listener; validar opções TLS/CORS não significa aplicar essas proteções. Os comportamentos futuros abaixo precisam dos testes previstos em [testing.md](testing.md). Configuração e ciclo de vida são detalhados em [configuration.md](configuration.md); restrições de arquivos em [filesystem.md](filesystem.md).

## Modelo de confiança e escopo

**Requisitos aprovados:** uso em rede local, uma raiz compartilhada, clientes autorizados por Bearer token e conexão HTTPS obrigatória. Todos os tokens oferecem as mesmas permissões. Não há cadastro, identidade pessoal inferida de token, perfis, permissões por usuário, OAuth, mTLS, CA própria ou implantação pública na internet.

O operador escolhe a pasta e as credenciais; o processo executa com as permissões de seu usuário Linux. A política de caminhos limita as operações da API, mas não substitui as permissões do sistema nem impede outro processo autorizado a escrever nos mesmos diretórios. Arquivos enviados são dados: não devem ser executados pelo servidor. Não há promessa de inspeção antivírus ou de confiabilidade do conteúdo.

Não alterar firewall, instalar ferramentas globais, modificar políticas do sistema, matar processos que usam a porta ou instalar certificados em clientes. Tais ações não fazem parte da preparação nem da inicialização planejadas.

## Autenticação Bearer

**Requisitos aprovados:** enviar `Authorization: Bearer TOKEN`; todas as operações de arquivos e `GET /health` exigem credencial válida. A autenticação precede operações e, quando possível, o processamento integral de uploads. Tokens não podem aparecer em URLs ou logs. Token ausente ou inválido resulta em `401` e `WWW-Authenticate` adequado; cliente autenticado que tenta escapar da raiz recebe `403`. Formato de erros em [errors.md](errors.md).

**Propostas de implementação:**

- Exigir uma única credencial Bearer não vazia, rejeitando headers ambíguos ou duplicados; validar o token sem refletir seu conteúdo em erros.
- Gerar por padrão 16 tokens temporários por execução, cada um com 32 bytes de aleatoriedade criptográfica codificados de forma transportável no header. A geração deve usar o gerador criptograficamente seguro do runtime; não usar `Math.random`.
- Comparar segredos por representações de comprimento fixo e primitiva apropriada, por exemplo digests de comprimento fixo com comparação temporalmente segura; revisar o fluxo completo para não prometer resistência a timing apenas pela escolha de uma função. As capacidades pertinentes constam na [documentação de criptografia do Node.js](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptotimingsafeequala-b).
- Aplicar autenticação antes dos parsers que consomem corpos de upload. Bytes já enviados pelo cliente podem chegar ao transporte; rejeição precoce significa evitar processamento integral e operação no filesystem, não garantir que nenhum byte tenha sido recebido.

Tokens gerados automaticamente duram enquanto o processo estiver ativo. Reiniciar com nova geração invalida os anteriores. O modo explícito de tokens externos permite automação e pode manter as mesmas credenciais após reinício; a documentação não deve afirmar rotação automática nesse modo. Não há endpoint de distribuição pública, renovação ou cadastro de tokens no escopo.

## Credenciais, chaves e estado privado

**Requisitos aprovados:** tokens e chaves privadas ficam fora da pasta compartilhada. Se houver arquivo de entrega ao operador, ele deve estar em diretório privado externo à raiz e ignorado pelo Git. Nenhum token ou chave pode aparecer em resposta HTTP, stack trace devolvido, log de requisição ou arquivo versionado.

**Proposta:** entregar tokens gerados em arquivo privado do estado local, com permissão `0600`, dentro de diretório `0700`; não imprimi-los em stdout/stderr por padrão. O arquivo de entrega é substituído de forma segura a cada nova geração e não serve como fonte de persistência automática. No modo externo, validar formato e permissões da fonte configurada, não sobrescrevê-la. Os caminhos e a precedência exatos ficam em [configuration.md](configuration.md).

A disposição planejada mantém estado e staging fora do repositório, além de fora da raiz; a etapa 2 criou [.gitignore](../.gitignore) para dependências, artefatos gerados, `.env*`, `*.key`, `*.pem`, `*.crt` e `tokens.json`. Nenhum token, chave ou certificado foi criado. As relações físicas com a raiz/repositório e permissões ainda não são verificadas pelo parser. Ignorar um arquivo no Git não remove um segredo já versionado.

O certificado público pode ser entregue aos clientes para configurar confiança explicitamente. A chave privada permanece somente com o operador/servidor. Arquivos fornecidos pelo operador não devem ser copiados para a raiz compartilhada. Os logs podem informar o estado da inicialização e falhas sanitizadas; não devem incluir objetos de requisição ou de configuração que contenham segredos.

## HTTPS e certificados

**Requisitos aprovados:** listener TLS no modo normal, com TLS 1.2 ou superior e TLS 1.3 quando suportado. Não há fallback para HTTP nem listener HTTP de redirecionamento. Falha de chave, certificado ou configuração TLS impede prontidão e escuta normal. Express trata requisições/respostas; o transporte HTTPS é preparado no ciclo de vida sem alterar a regra dos handlers.

O listener normal só será integrado na etapa 8. Testes internos anteriores podem exercitar aplicação e regras sem um serviço de rede exposto; isso não autoriza um comando público de inicialização por HTTP. A etapa 8 deverá verificar conexão HTTPS real e ausência de fallback.

| Aspecto | Autoassinado para desenvolvimento local | Certificado fornecido pelo operador |
| --- | --- | --- |
| Preparação aprovada | Gerar certificado e chave na primeira preparação | Ler certificado/cadeia e chave dos caminhos configurados |
| Identidade aprovada | Incluir no SAN os IPs e nomes configurados | Validar adequação às identidades configuradas e à utilização como servidor |
| Validação aprovada | Validade temporal e correspondência com a chave | Chave/certificado carregáveis e correspondentes; validade temporal e configuração TLS coerente |
| Reuso aprovado | Reaproveitar arquivos ainda válidos segundo a política | Reutilizar os arquivos do operador sem modificá-los |
| Renovação planejada | Política de validade e margem documentada em configuração; regenerar somente na preparação quando necessário | Operador renova os arquivos; proposta de carregamento por reinício controlado |
| Confiança do cliente | Cliente precisa confiar explicitamente no certificado apropriado | Depende da cadeia pública ou privada aceita pelo cliente |

**Proposta:** validar SAN, datas, correspondência da chave e critérios de renovação em cada inicialização; rejeitar preparação incompleta ou insegura com diagnóstico local sanitizado. No modo autoassinado, regenerar apenas o material pertencente ao servidor quando inválido, ausente, próximo da expiração ou incompatível com as identidades configuradas. No modo fornecido, nunca sobrescrever ou renovar arquivos automaticamente. Os valores de validade, margem e nomes das opções têm uma única definição em [configuration.md](configuration.md). A biblioteca de emissão ainda será selecionada na etapa pertinente; não exigir `mkcert`, `step-ca`, uma CA pública ou dependência instalada globalmente.

Os papéis de TLS e autenticação são distintos:

- O certificado associa uma chave pública à identidade apresentada pelo servidor; a chave privada permite ao servidor provar controle dessa chave durante a conexão e deve permanecer secreta.
- TLS negocia a conexão protegida. O cliente verifica o certificado, sua confiança, validade e identidade correspondente ao hostname ou IP utilizado.
- Aceitar um aviso do navegador não assina o certificado, não o transforma em certificado emitido por uma CA e não autentica o usuário na API.
- Confiar no certificado não fornece um Bearer token; ainda é necessária a autenticação da requisição.

Os exemplos e testes principais devem manter validação de certificado e identidade. Para autoassinado, fornecer explicitamente ao cliente o certificado confiável correto, por exemplo com `curl --cacert`, e usar um endereço presente no SAN. Não usar `--insecure`, `rejectUnauthorized: false` ou desativação global de verificação como configuração padrão. Os exemplos completos de requisição são os de [endpoints.md](endpoints.md); seus comandos ainda dependem do servidor futuro.

## CORS

**Requisitos aprovados:** lista configurável de origens, sem liberação geral por padrão; permitir os métodos do contrato, `Authorization` e os tipos de conteúdo necessários; expor `Content-Disposition` e `Location` ao cliente web. Preflight deve responder sem exigir o token da operação, mas a requisição efetiva continua autenticada.

**Proposta de política:**

| Situação | Comportamento planejado |
| --- | --- |
| Configuração padrão | Lista vazia `[]`; nenhuma origem web recebe autorização CORS |
| Origem explicitamente permitida | Responder com a origem exata autorizada e `Vary: Origin`; não refletir origens arbitrárias |
| Preflight permitido | Responder `204`, sem corpo, para rota/método/headers permitidos; não consultar ou modificar arquivos |
| Métodos | `GET`, `PUT`, `DELETE`, `PATCH`, `POST` e `OPTIONS` para preflight |
| Headers de requisição | `Authorization` e `Content-Type`; corpo conforme JSON ou multipart do endpoint |
| Headers expostos | `Content-Disposition` e `Location` |
| Origem não permitida | Não fornecer autorização CORS; o navegador pode impedir o acesso à resposta |
| Cliente sem `Origin` | Política normal de HTTPS, autenticação e contrato; CORS não é uma autorização adicional |
| `Origin: null` | Bloqueado por padrão; só admitir por opção explícita na lista conforme configuração |

`Origin: null` não identifica exclusivamente um arquivo HTML aberto por `file://`: contextos de origem opaca também podem usar esse valor. Uma eventual liberação deve aceitar essa limitação, não presumir confiança em um arquivo local específico. Não implementar suporte adicional de frontend por causa dessa opção.

CORS é uma regra aplicada por navegadores para acesso entre origens; clientes como `curl` não dependem dela para enviar requisições. A lista de origens não substitui autenticação e não valida certificados. Uma requisição pode alcançar o servidor mesmo que o navegador não exponha sua resposta; portanto, todas as operações efetivas precisam das mesmas verificações. O funcionamento de preflight e dos headers está definido no [protocolo CORS do Fetch Standard](https://fetch.spec.whatwg.org/#http-cors-protocol).

## Validação, transferências e isolamento

TypeScript foi escolhido pelo usuário para a implementação; Zod, para validar entradas em execução; Express, para a camada HTTP. Tipos estáticos não validam por si só conteúdo recebido da rede. A validação planejada aplica esquema e limites antes da operação principal, trata campos desconhecidos conforme [endpoints.md](endpoints.md) e centraliza respostas `application/problem+json` em [errors.md](errors.md).

O nome de arquivo multipart não determina o destino do upload: somente `path` validado. O arquivo é recebido em staging privado; exceder o limite, falhar ou desconectar antes da publicação deve preservar o destino anterior. Downloads usam nomes seguros em `Content-Disposition`; ZIP inclui apenas nomes relativos válidos e aplica os limites configurados durante o processamento. Não incorporar nomes brutos de arquivo diretamente em headers.

Links simbólicos são proibidos em componentes, entradas e árvores recursivas. Tipos especiais, hard links e montagens têm propostas e limitações explícitas em [filesystem.md](filesystem.md). Proteções baseadas em verificações de caminho e mutex de um processo não oferecem isolamento absoluto contra alterações feitas por outros processos. Nenhuma garantia de sandbox local hostil deve ser anunciada.

Erros não podem revelar caminhos absolutos, stack traces, tokens ou chaves. Se uma transferência já enviou os headers, encerrar a transferência e limpar os recursos; não tentar substituir retroativamente a resposta por JSON. A resposta de saúde deve indicar apenas a verificação mínima efetivamente feita e não divulgar configuração nem afirmar disponibilidade de todas as operações.

## Verificações de segurança previstas

Ainda não executadas: autenticação ausente/inválida/válida em todas as rotas; rejeição precoce de upload não autenticado; tokens temporários versus externos; separação e permissões do estado privado; traversal e links; preservação de destino e limpeza; TLS real com confiança configurada; falhas por validade, identidade e chave inadequadas; ausência de HTTP; preflight permitido; falta de autorização CORS para origem não permitida; token obrigatório na operação efetiva; ausência de segredos em erros. Certificados e diretórios de teste serão exclusivos e temporários. O estado factual de execução será mantido em [testing.md](testing.md).
