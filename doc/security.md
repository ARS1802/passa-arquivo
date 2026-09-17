# Segurança entre dispositivos

O passa-arquivo usará certificados para reconhecer os dispositivos. A primeira
conexão será confirmada pelas pessoas; as seguintes usarão a confiança salva.
Esse funcionamento ainda não está implementado.

## Identidade criada na instalação

Cada instalação gera seu próprio par de chaves e seu certificado digital. A
chave pública está no certificado e pode ser compartilhada. A chave privada
fica somente naquela máquina, em armazenamento protegido.

O material deve ser criado localmente para cada instalação, nunca distribuído
como um par de chaves igual para todos. Reiniciar o programa, atualizar a
aplicação ou mudar de IP não deve gerar outra identidade automaticamente.
Algoritmo, tamanho de chave, validade e perfil do certificado ainda precisam ser
escolhidos. A geração faz parte da preparação local da instalação, não de cada
requisição.

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
listar, ler ou alterar arquivos. Só depois do aceite e da confirmação do código
os certificados serão salvos como identidades confiáveis.

## Código de verificação

A gera um código curto para aquela tentativa. O usuário A o entrega ao usuário B
fora do canal que está sendo verificado, e o usuário B o informa em sua interface
local. Ambos ativam a descoberta e precisam estar de acordo com o pareamento.

O código precisa ter uso único, prazo de validade, limite de tentativas e estar
ligado aos dois certificados e à sessão. Não pode aparecer em URL, log, anúncio
de descoberta nem em uma resposta que qualquer candidato consiga consultar.

Enviar o código como texto para o desconhecido e depois pedir que ele o repita
não impede personificação. Um intermediário poderia receber e retransmitir esse
mesmo valor. Também não basta inventar um hash de poucos dígitos dos certificados
sem analisar como o protocolo impede substituições e tentativas de adivinhação.

O mecanismo criptográfico ainda precisa ser selecionado e revisado. Uma família
adequada para avaliar é PAKE: protocolos que permitem confirmar um segredo curto
compartilhado sem enviá-lo diretamente. A RFC de SPAKE2 descreve confirmação
mútua de chaves e vinculação de identidades. Ela é uma referência para avaliação,
não um protocolo já escolhido ou implementado no projeto.
[RFC 9382](https://www.rfc-editor.org/rfc/rfc9382.html#section-3.3).

A integração escolhida terá de vincular a confirmação aos certificados
apresentados e à sessão de transporte, recusando troca de certificado, repetição
de mensagens e confirmação em outra sessão. O fluxo de telas, isoladamente,
não demonstra proteção criptográfica contra um intermediário.

## mTLS no primeiro contato e depois dele

Em TLS comum, o cliente normalmente confere o certificado do servidor. Em
**mTLS**, os dois lados apresentam certificados e provam que controlam suas
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
as confirmações. A política exata e a separação de portas/contextos TLS precisam
ser definidas antes da implementação.

Escolher uma rota Express diferente não muda uma decisão TLS já tomada antes
que a requisição HTTP chegue. Também não basta enviar um PEM no corpo: o
certificado deve corresponder à identidade que participa do protocolo e à chave
cuja posse foi demonstrada.

No Node.js, pedir certificado ao cliente e decidir quais certificados são
confiáveis são controles distintos. Não se deve liberar certificados arbitrários
no serviço de arquivos nem desativar globalmente a verificação TLS para tornar o
pareamento possível. Esses controles estão na
[documentação de TLS do Node.js](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener).

## Confiança nos dois sentidos

Depois da confirmação, B salva o certificado de A e A salva o de B. Em cada nova
conexão de uso normal, os dois conferem o certificado registrado e a prova de
posse da chave. Uma cópia do certificado público, sem a chave privada, não basta
para se passar pelo peer.

O nome é apenas uma identificação visual. O IP serve para encontrar a máquina.
Nenhum dos dois pode substituir a conferência do certificado. Descobrir outro
certificado no mesmo endereço não autoriza atualizar o registro automaticamente.

O perfil de identidade TLS precisa tratar essa independência do IP. A validação
comum de HTTPS confere nomes/IPs do certificado; ela não se transforma em
verificação de identidade persistente só porque um certificado foi salvo. O
cliente P2P precisará de uma política explícita de identidade e pinning, mantendo
verificações criptográficas e de validade. O perfil e os nomes usados ainda
estão em definição. A API de validação de identidade está documentada pelo
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

A API não exige Bearer como identidade dos peers neste desenho. Os campos de
tokens ainda presentes no código pertencem à configuração anterior e não
implementam autenticação P2P.

## Arquivos e dados privados

Chaves privadas, códigos e dados de pareamento não podem aparecer em respostas
de arquivos ou logs. Certificados públicos são compartilháveis, mas a lista de
peers, seus nomes e horários é informação privada da instalação.

A identidade de um peer não autoriza sair da pasta compartilhada. Links, caminhos
inválidos, conflitos de destino e limites de transferência continuam sujeitos
às [regras de arquivos](filesystem.md). Arquivos recebidos não serão executados
pelo servidor.

O armazenamento privado deve usar as proteções de cada sistema; permissões
POSIX não substituem ACLs do Windows. Veja [Linux e Windows](platforms.md).
A aplicação não instalará confiança global nos clientes, não mudará o firewall
nem encerrará processos para liberar portas.
