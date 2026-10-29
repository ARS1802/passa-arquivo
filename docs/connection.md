# Encontrar e conectar dispositivos

O passa-arquivo permitirá encontrar outros dispositivos na rede local e decidir
com quais deles compartilhar arquivos. Quase todos os fluxos começam com uma
ação do usuário na GUI. A descoberta é um desses fluxos: a pessoa decide quando
quer procurar um dispositivo, compartilhar uma pasta ou apenas ler os arquivos
de outro peer. A descoberta e o pareamento ainda não estão implementados.

## Abrir a descoberta

Os usuários de A e B precisam ativar a descoberta. Durante essa janela, cada
aplicação poderá procurar outros dispositivos e responder às buscas recebidas.
Com a descoberta desligada, novos dispositivos não poderão iniciar o pareamento.

O nome provisório dessa entrada é `/connect`. A ativação parte de uma ação local
do usuário. Um endpoint desativado na rede não pode receber a própria ordem de
ativação: a interface deverá acionar o módulo localmente, por um mecanismo de
controle ainda a definir. Uma chamada remota não poderá abrir essa janela nem
ordenar uma varredura.

Desligar a descoberta encerra buscas e a entrada de novos pedidos. Não apaga
certificados conhecidos nem obriga a interromper conexões já autenticadas.
A aplicação precisará diferenciar a entrada temporária de pareamento do serviço
que atende peers conhecidos. A disposição de portas ainda não está definida.

## O que informar na busca

O usuário inicia o controle local de `/connect` pela GUI. A implementação do
controller deverá aceitar parâmetros que delimitem os
destinos da busca. A forma final do JSON ainda será definida, mas os dados são:

| Dado | Exemplo | Significado |
| --- | --- | --- |
| Endereços locais | `192.168.1.20`, `192.168.1.35` | Procurar dispositivos nesses IPs. |
| Redes locais | `192.168.1.0/24` | Procurar dentro da faixa indicada em notação CIDR. |
| Interface local, quando necessária | A placa conectada à rede escolhida | Evitar procurar pela interface errada, por exemplo em uma VPN. |

Serão necessários limites de quantidade de destinos, tempo e buscas simultâneas,
além de cancelamento. Os valores ainda não foram escolhidos. Redes sobrepostas
não devem gerar tentativas duplicadas. Entradas malformadas, redes fora do
conjunto local permitido e alvos não autorizados precisam ser recusados.

IPv6 também precisa de tratamento próprio: percorrer todos os endereços de uma
rede `/64` não é uma estratégia viável. Os mecanismos e o alcance inicial de
descoberta IPv6 ainda serão definidos, mantendo os destinos limitados.

Um resultado de busca é apenas um candidato. Nome, IP e certificado anunciado
ainda não provam que se trata da máquina desejada. B precisa estar acessível pela
rede e com a descoberta ativa para aparecer.

## Da busca ao aceite

1. Os dois usuários ativam a descoberta. A varre somente os destinos escolhidos
   e mostra os candidatos ao usuário A.
2. O usuário A seleciona B e pede a conexão. A apresenta seu certificado público
   e uma identificação da sessão de pareamento; B apresenta seu certificado.
3. A gera um código curto, numérico ou alfanumérico, com aleatoriedade segura,
   exclusivo daquela tentativa. O código aparece para o usuário A.
4. O usuário A informa o código ao usuário B por um canal fora da conexão que
   está sendo verificada, por exemplo pessoalmente ou em uma ligação confiável.
   O código pode ser digitado na interface local de B.
5. B só aceita após o usuário confirmar o pedido e o protocolo conferir o código,
   os certificados e a sessão. O código nunca autoriza outro pedido simultâneo.
6. B salva o certificado de A, e A salva o de B. Os dois lados confirmam a
   conclusão e registram nome, certificado e horários de conexão.
7. Conexões de uso normal passam a exigir mTLS e a identidade já registrada.
   Cada lado confere o outro antes de liberar acesso a arquivos.

As regras para o código e para o primeiro contato estão em
[Segurança](security.md). Os dados persistidos estão em [Dispositivos conhecidos](peers.md).

## Recusa, expiração e repetição

O usuário pode recusar um pedido. Um código errado, expirado ou já utilizado não
conclui o pareamento. Cancelar a descoberta também encerra tentativas ainda não
confirmadas. Um certificado apresentado novamente não recebe confiança só por
ter aparecido em uma busca anterior.

Pedidos repetidos da mesma sessão não devem criar peers duplicados. Aceites,
cancelamentos e repetições precisam ser vinculados à sessão e aos mesmos
certificados. Uma queda de conexão pode deixar a confirmação incompleta entre
os dois lados; a aplicação deverá mostrar essa situação sem anunciar sucesso
antes da confirmação bilateral.

## Contrato HTTP em definição

`/connect` representa hoje um fluxo de descoberta e pareamento, não uma URL
definitiva para todas as mensagens. A recomendação é usar `POST` para iniciar
operações; uma consulta `GET` não deve iniciar varredura, salvar confiança ou
aceitar pedidos. Isso segue a distinção entre consulta e processamento definida
na [semântica HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3).

É possível organizar a interface final em recursos de sessões e pedidos. A escolha
dos nomes, do versionamento, dos corpos JSON, dos códigos HTTP, da consulta de
resultados e da confirmação ainda precisa ser fechada. Não há rota de peers
adicional nem polling, WebSocket ou SSE escolhido por esta descrição.

O contrato deverá separar comandos do usuário local de mensagens enviadas pelo
peer. Receber um pedido remoto nunca dará ao remetente poder para escolher redes
a varrer ou confirmar seu próprio aceite. Limites e proteção do controle local
são necessários mesmo quando a chamada vem da própria máquina.
