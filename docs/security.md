# Segurança entre dispositivos

O passa-arquivo usará certificados para reconhecer os dispositivos. A primeira
conexão será confirmada pelas pessoas; as seguintes usarão a confiança salva.
A identidade local, a descoberta e o fluxo de pareamento usam os certificados
persistentes. A confirmação humana compara as impressões digitais completas,
conforme o [fluxo de conexão](connection.md).

## Identidade criada na instalação

Na primeira instalação ou execução, cada peer gera seu próprio par de chaves e
seu certificado digital. A
chave pública está no certificado e pode ser compartilhada. A chave privada
fica somente naquela máquina, em armazenamento protegido.

O material deve ser criado localmente para cada instalação, nunca distribuído
como um par de chaves igual para todos. Reiniciar o programa, atualizar a
aplicação ou mudar de IP não deve gerar outra identidade automaticamente.
A implementação local usa RSA de 2048 bits, assinatura SHA-256 e validade de
365 dias, com uso de cliente e servidor TLS. O nome é único por instalação e
não depende do IP. O model prepara a identidade na primeira execução e não a
regenera automaticamente em caso de perda ou expiração. A geração faz parte da
preparação local da instalação, não de cada requisição.

## TOFU com confirmação humana

TOFU significa *Trust On First Use*: a confiança é estabelecida no primeiro
uso e depois lembrada. No passa-arquivo, isso exige a confirmação do usuário;
não significa confiar silenciosamente no primeiro certificado que aparecer.

No primeiro contato, A e B ainda não conhecem os certificados um do outro. A
apresentação do certificado e a prova de posse da chave não confirmam, sozinhas,
que aquela máquina é a escolhida pela pessoa. No TLS 1.3, essa prova de posse é
feita por uma assinatura no handshake, conforme a
[RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html#section-4.4.3).

Por isso, o primeiro contato precisa ficar restrito ao pareamento. Ele não pode
listar, ler ou alterar arquivos. Só depois do aceite e da conferência dos certificados
os certificados serão salvos como identidades confiáveis.

## Conferência das impressões digitais

O usuário de A comunica a impressão digital SHA-256 completa do certificado de A
por um canal confiável fora da conexão em verificação. O usuário de B confere
esse valor com o certificado recebido na sessão; os usuários repetem o processo
no sentido inverso. São 64 caracteres hexadecimais, com dois-pontos opcionais
como separadores. Não basta comparar poucos caracteres nem usar o próprio
anúncio de rede como fonte independente da comparação.

Esse procedimento substitui o código curto. O Node fornece o valor por
[`X509Certificate.fingerprint256`](https://nodejs.org/api/crypto.html#x509fingerprint256).
Não há biblioteca PAKE, algoritmo criptográfico próprio ou código secreto enviado
pela rede. A comunicação continua usando TLS e as verificações nativas dos certificados.

O aceite fica ligado ao identificador da sessão e aos dois certificados. A
janela dura até 120 segundos, e três comparações incorretas recusam o pedido.
`acceptPairingRequest` só é chamado localmente; nenhuma rota remota pode registrar
esse aceite em nome da pessoa. Um pedido ou uma confirmação de gravação recebidos
antes do aceite local não liberam confiança.

Preparar o registro em disco não autoriza arquivos. O serviço coordena as duas
preparações antes de pedir a confirmação. Falhas são propagadas e podem exigir
repetição da mesma sessão, como descrito em [Conexão](connection.md#recusa-expiração-e-repetição).

## mTLS no primeiro contato e depois dele

Em TLS comum, o cliente normalmente confere o certificado do servidor. Em
**mTLS**, os dois lados apresentam seus certificados e provam que controlam suas
chaves privadas. Um peer pode atuar como cliente em uma conexão e servidor em outra.

Há dois contextos diferentes de confiança:

| Contexto | Certificado conhecido? | Acesso permitido |
| --- | --- | --- |
| Descoberta e pareamento, ativados localmente | Ainda não | Somente mensagens limitadas do pareamento; identidade ainda não confiável |
| Uso normal entre peers | Sim, confirmado e persistido | Operações de arquivos permitidas pela aplicação, depois da verificação mútua |

Uma configuração que rejeita todo certificado desconhecido no handshake não
consegue receber o primeiro pedido HTTP de pareamento. O contexto temporário
precisará permitir a apresentação de certificados ainda não confiáveis, conferir
posse de chave e formato, e mantê-los sem acesso à API de arquivos até concluir
as confirmações. A entrada temporária de descoberta foi definida na porta
**8444**, com TLS 1.3, e permanece aberta por até 120 segundos após uma chamada
local do controller. Ela recebe certificados ainda desconhecidos para consultar anúncios e trocar
mensagens da própria sessão. Essas mensagens não substituem o aceite humano.

Escolher uma rota Express diferente não muda uma decisão TLS já tomada antes
que a requisição HTTP chegue. Também não basta enviar um PEM no corpo: o
certificado deve corresponder à identidade que participa do protocolo e à chave
cuja posse foi demonstrada.

No Node.js, pedir certificado ao cliente e decidir quais certificados são
confiáveis são controles distintos. Não se deve liberar certificados arbitrários
no serviço de arquivos nem desativar globalmente a verificação TLS para tornar o
pareamento possível. Esses controles estão na
[documentação de TLS do Node.js](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener).

Na descoberta, `rejectUnauthorized: false` é usado somente na entrada temporária
e nas consultas a candidatos. Isso permite apresentar um certificado ainda não
cadastrado; não o torna confiável. O handshake exige certificado de cliente e
prova de posse da chave, e o controller confere validade e assinatura do
certificado autoassinado. O anúncio devolve apenas nome e certificado público.
O cliente das mensagens de pareamento usa `rejectUnauthorized: true`, com o
certificado esperado como confiança TLS e pinning do certificado exato. Não usa
o IP como identidade. O listener de arquivos mantém `rejectUnauthorized: true`
e sua lista de certificados confiáveis, recarregada após a conclusão do pareamento.
Nenhuma chave privada aparece no anúncio ou nas respostas de sessões.

## Confiança nos dois sentidos

Depois da confirmação, B salva o certificado de A e A salva o de B. Em cada nova
conexão de uso normal, os dois conferem o certificado registrado e a prova de
posse da chave. Uma cópia do certificado público, sem a chave privada, não basta
para se passar pelo peer.

O nome é apenas uma identificação visual. O IP serve para encontrar a máquina.
Nenhum dos dois pode substituir a conferência do certificado. Descobrir outro
certificado no mesmo endereço não autoriza atualizar o registro automaticamente.

O perfil de identidade TLS descrito acima não usa o IP como identidade. A
validação comum de HTTP confere nomes/IPs do certificado; ela não se transforma
em verificação de identidade persistente só porque um certificado foi salvo.
O cliente P2P de arquivos ainda precisará de uma política explícita de identidade
e pinning, isto é, conferir o certificado exato que foi salvo, mantendo as
verificações criptográficas e de validade. Esse cliente continua pendente.
A API de validação de identidade está documentada pelo
[Node.js](https://nodejs.org/api/tls.html#tlscheckserveridentityhostname-cert).

## Troca de certificado e perda de chave

Um certificado expirado ou uma chave comprometida exige tratamento explícito.
Trocar o certificado muda o material que foi reconhecido no pareamento.
Preservar confiança durante renovação requer um procedimento autenticado; na
falta dele, será necessário parear novamente. Essa política ainda será fechada.

Perder a chave privada não deve ser tratado como uma simples mudança de IP.
Restaurar cópias da mesma chave em máquinas diferentes também elimina a distinção
entre elas. Os registros precisam permitir retirar confiança de um peer, com
regras para conexões já abertas ainda a definir.

Os dados persistidos são descritos em [Dispositivos conhecidos](peers.md).

## Controle local e navegador

A ação de abrir a descoberta, escolher redes ou aceitar um peer pertence ao
usuário local. Uma mensagem remota não pode executar essas ações em seu nome.
A forma de proteger o controle local ainda precisa ser definida; usar apenas um
endereço de loopback não é prova de autorização do usuário.

mTLS entre peers não resolve automaticamente o acesso de uma interface web ao
módulo local. Essa interface é outro componente. CORS pode limitar quais páginas
leem respostas no navegador, mas não autentica um dispositivo nem substitui a
proteção do controle local. Preflight HTTP também não ultrapassa uma exigência
TLS que ocorre antes da requisição.


Os certificados dos peers são a identidade exigida neste desenho. Durante a
transferência de arquivos, o certificado confirmado funciona como a credencial
ou token de autenticação da conexão. A chave privada nunca é enviada: ela prova
que o dispositivo possui a identidade correspondente ao certificado.

## Arquivos e dados privados

Chaves privadas, códigos e dados de pareamento não podem aparecer em respostas
de arquivos ou logs. Certificados públicos são compartilháveis, mas a lista de
peers, seus nomes e horários é informação privada da instalação.

A identidade de um peer não autoriza sair da pasta compartilhada. Links, caminhos
inválidos, conflitos de destino e limites de transferência continuam sujeitos
às [regras de arquivos](filesystem.md). Arquivos recebidos não serão executados
pelo servidor.

As áreas de estado e staging devem permanecer separadas da raiz compartilhada.
Veja [Linux e Windows](platforms.md).
A aplicação não instalará confiança global nos clientes, não mudará o firewall
nem encerrará processos para liberar portas.
