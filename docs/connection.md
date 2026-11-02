# Encontrar e conectar dispositivos

O passa-arquivo permitirá encontrar outros dispositivos na rede local e decidir
com quais deles compartilhar arquivos. Quase todos os fluxos começam com uma
ação do usuário na GUI. A descoberta é um desses fluxos: a pessoa decide quando
quer procurar um dispositivo, compartilhar uma pasta ou apenas ler os arquivos
de outro peer. O controller já oferece a descoberta por uma entrada temporária.
O pareamento usa a conferência das impressões digitais completas dos certificados.
Encontrar um candidato não salva seu certificado como confiável.

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
A entrada temporária usa HTTPS na porta **8444**, com TLS 1.3, e fica separada
do serviço de arquivos, cuja porta padrão é **8443**. A entrada temporária não
registra rotas de arquivos. O serviço de arquivos continua exigindo certificados
confiáveis; abrir a descoberta não muda essa exigência.

A abertura é feita por `openDiscovery`, em
`controller/api/routes/connect.ts`, chamado por código local do controller.
O método recebe `displayName`, `listenAddress` e, opcionalmente, `interfaceName`.
Por exemplo, o nome pode ser `Notebook da Ana`, o IP local de escuta pode ser
`192.168.1.20` e a interface pode ser `wlp2s0`. O IP e a interface precisam
corresponder ao computador que está executando a aplicação; não são valores
prontos para copiar em qualquer máquina.

`closeDiscovery` fecha essa entrada e aguarda a liberação da porta. A janela
também fecha quando seu prazo termina. Nem a abertura nem o encerramento são
comandos HTTP disponíveis para um candidato remoto. A integração desses comandos
com a GUI e sua autorização local ainda precisam ser implementadas.

## O que informar na busca

O usuário inicia o controle local de `/connect` pela GUI. A implementação do
controller usa `discover`, em `controller/connection/discoveryService.ts`,
com os campos `addresses` e `networks`. Esses dados são argumentos da chamada
local, não um corpo HTTP que um desconhecido possa enviar para iniciar buscas:

| Dado | Exemplo | Significado |
| --- | --- | --- |
| Endereços locais | `192.168.1.20`, `192.168.1.35` | Procurar dispositivos nesses IPs. |
| Redes locais | `192.168.1.0/24` | Procurar dentro da faixa indicada em notação CIDR. |
| Interface local, quando necessária | A placa conectada à rede escolhida | Evitar procurar pela interface errada, por exemplo em uma VPN. |

Os limites são:

| Limite | Valor | Efeito |
| --- | --- | --- |
| Janela de descoberta | 120 segundos | Ao terminar, fecha o listener e cancela as tentativas da busca. |
| Destinos distintos | 256 por busca | A lista inteira é conferida antes de abrir conexões. |
| Tentativas simultâneas | 8 | Os demais destinos aguardam sua vez; outra busca na mesma janela é recusada. |
| Prazo por tentativa | 2 segundos | Inclui conexão, TLS e leitura da resposta, não apenas períodos de inatividade. |
| Tamanho do anúncio | 16 KiB | Uma resposta maior ou malformada é recusada. |

As redes permitidas vêm das interfaces reais do sistema operacional. Escolher
uma interface limita a busca às redes dela. Um IP ter aparência de endereço
privado não basta para torná-lo permitido.

Por exemplo, se a interface selecionada pertence a `192.168.1.0/24`, um pedido
para `10.20.0.5` será recusado antes de abrir uma conexão. Dois CIDRs sobrepostos
e endereços repetidos geram somente uma tentativa para cada IP. Em redes IPv4
com prefixo até `/30`, a expansão não inclui os endereços de rede e broadcast;
em `/31` e `/32`, considera os endereços individuais da faixa. CIDRs precisam
usar o endereço da rede: escreva `192.168.1.0/24`, não `192.168.1.20/24`.

IPv6 aceita somente endereços explícitos; CIDRs IPv6 não são expandidos. Um
endereço link-local, como `fe80::1234`, exige uma interface explícita. Não são
aceitos DNS, URLs, multicast, endereço não especificado ou IPv4 mapeado em IPv6.

Um resultado de busca é apenas um candidato. Nome, IP e certificado anunciado
ainda não provam que se trata da máquina desejada. B precisa estar acessível pela
rede e com a descoberta ativa para aparecer.

### Exemplo de chamada pelo controller

Depois de a inicialização preparar o model no mesmo processo, o controller pode
executar:

```ts
const window = await openDiscovery({
  displayName: "Notebook da Ana",
  listenAddress: "192.168.1.20",
  interfaceName: "wlp2s0",
});
const result = await discover({
  addresses: ["192.168.1.35"],
  networks: ["192.168.1.0/24"],
});
await window.close();
```

As funções são importadas de `controller/api/routes/connect.ts` e
`controller/connection/discoveryService.ts`, respectivamente. Esses IPs e nomes
de interface são exemplos: devem ser substituídos pelos da rede escolhida.
Chamar as funções em outro processo não abre uma janela no backend já iniciado.

O resultado tem `candidates`, `failures` e `cancelled`. Cada candidato contém
`ipAddress`, `displayName` e `certificatePem`. Cada falha tem o IP e uma razão:
`unreachable` (não respondeu), `timeout` (excedeu o prazo), `invalid_response`
(anúncio recusado), `cancelled` (janela encerrada) ou `self` (a própria identidade
local, que não vira um candidato). O certificado vem do handshake e precisa ser
igual ao anunciado no corpo. Esses dados continuam sem confiança de pareamento.

## Da busca ao aceite

1. Os dois usuários abrem a descoberta, com `openDiscovery`, e A encontra B.
2. A chama `startPairingRequest(candidate, displayName)`. O serviço cria uma sessão
   e envia o pedido a B por HTTPS, usando os certificados dos dois lados no TLS.
3. Cada usuário comunica a impressão digital de sua própria instalação ao outro
   por um canal confiável fora da conexão em verificação, por exemplo pessoalmente.
   Cada valor SHA-256 tem 64 caracteres hexadecimais; os dois-pontos são separadores.
4. Em cada computador, `acceptPairingRequest(id, expectedFingerprint)` compara o
   valor completo informado com o certificado remoto desta sessão. Não basta usar
   uma impressão digital recebida pelo próprio anúncio, nem conferir só alguns caracteres.
5. A chama `completePairingRequest(id)`: prepara seu registro privado, pede a B
   que prepare o dele e aguarda ambas as gravações. B só prepara se seu usuário
   também tiver aceitado localmente.
6. A envia a confirmação a B. B conclui seu registro e recarrega a configuração TLS;
   A recebe a resposta, conclui seu próprio registro e também recarrega o TLS.
   Só então a chamada de A devolve `confirmed`.
7. Novas conexões na API de arquivos usam mTLS e os certificados confiáveis salvos.

Não há um código curto neste fluxo. A impressão digital completa substitui esse
código para permitir uma confirmação com os recursos nativos já usados pelo
projeto. `X509Certificate.fingerprint256` fornece o valor; o TLS continua fazendo
as operações criptográficas. Não foi criado um algoritmo de criptografia próprio.

### Chamadas locais do controller

| Função em `paringService.ts` | O que faz |
| --- | --- |
| `createPairingRequest(candidate)` | Cria apenas a sessão local; preserva o uso sem envio de mensagens. |
| `startPairingRequest(candidate, displayName)` | Cria ou reutiliza a sessão e envia o pedido ao candidato. |
| `getPairingRequest(id)` / `listPairingRequests()` | Consultam cópias dos pedidos locais. Não consultam a rede. |
| `acceptPairingRequest(id, expectedFingerprint)` | Registra o aceite local após a comparação completa do certificado remoto. |
| `refreshPairingRequest(id)` | Consulta o estado do participante remoto, sem aceitar em seu nome. |
| `completePairingRequest(id)` | Executa as gravações e confirmações pelo iniciador. |
| `rejectPairingRequest(id)` / `cancelPairingRequest(id)` | Encerram localmente, descartam a preparação e avisam o participante remoto. São assíncronas: use `await`. |

O pedido inclui `id`, `peer`, `localCertificatePem`, `localFingerprint`,
`peerFingerprint`, `createdAt`, `expiresAt`, `status`, `role`, `localAccepted`,
`remoteAccepted` e `attemptsRemaining`. `peer` mantém nome, IP e certificado do
candidato. Nenhuma consulta fornece a chave privada. `id` é um UUID v4 e não
substitui a conferência da identidade.

Os estados são `pending`, `prepared`, `committing`, `confirmed`, `rejected`,
`cancelled` e `expired`. `prepared` significa gravação privada sem confiança.
`committing` indica publicação da confiança ou recarga TLS em andamento; uma falha
nessa etapa é propagada e não retorna sucesso. A mesma sessão pode ser repetida.

Não há polling automático nem novo servidor de controle local. Abrir a descoberta,
aceitar e concluir são funções chamadas no processo da aplicação. A GUI ainda
precisa integrar essas ações e proteger seu acesso local. Uma requisição remota
não pode abrir a descoberta, escolher redes ou registrar aceite humano.

### Exemplo entre duas instalações de teste

O model e `openDiscovery` precisam estar preparados no processo de cada controller.
As funções abaixo são importadas de `controller/connection/paringService.ts`.

Em A, com B obtido por `discover`:

```ts
const request = await startPairingRequest(candidateB, "Notebook da Ana");
// expectedB vem do usuário de B, por um canal confiável e independente.
await acceptPairingRequest(request.id, expectedB);
```

Em B, o usuário consulta `listPairingRequests()`, escolhe o pedido correspondente
à instalação A e confere `expectedA`, recebido fora da conexão:

```ts
await acceptPairingRequest(requestId, expectedA);
```

De volta a A:

```ts
const result = await completePairingRequest(request.id);
console.log(result.status); // confirmed, somente após as gravações e a recarga TLS
```

O valor comunicado por cada pessoa é `localFingerprint` da sua própria instalação.
`peerFingerprint` é o valor observado do outro lado e precisa ser comparado com
essa informação independente. Os IPs, certificados e identificadores do exemplo
pertencem às instalações escolhidas; não são credenciais prontas para copiar.

## Recusa, expiração e repetição

A janela continua limitada a 120 segundos. Cada pedido usa o menor prazo entre
as janelas dos participantes. Um pedido criado depois de 60 segundos de uma
janela tem, no máximo, os 60 segundos restantes. Cada instalação usa seu próprio
relógio; o pedido envia a duração restante, não exige relógios iguais.

Há até três conferências incorretas da impressão digital por sessão. Depois da
terceira, o pedido é recusado. Esse limite pertence à ação local; não existe rota
para um desconhecido tentar confirmar impressões digitais em nome do usuário.

Fechar a descoberta cancela pedidos `pending` e `prepared`; o prazo os torna
`expired`. Preparações persistidas continuam sem acesso a arquivos e são
removidas na próxima inicialização do model. Cancelar ou recusar explicitamente
remove a preparação imediatamente. Se a gravação final já entrou em `committing`,
ela pode terminar, pois ambos os aceites e as preparações já foram conferidos.
Não é possível cancelar uma confiança já confirmada por uma mensagem de sessão.
Se uma preparação expirou sem cancelamento explícito, reinicie a instalação para
descartá-la antes de criar outra sessão para o mesmo certificado. O registro
pendente não é sobrescrito por uma sessão diferente.

Repetir o pedido pendente para o mesmo par de certificados reutiliza a sessão,
sem alterar nome, IP ou prazo. Um pedido remoto com outro identificador para a
mesma identidade aberta é recusado como conflito. Repetir a preparação e a
confirmação da mesma sessão não cria outro diretório nem altera o primeiro horário.
A janela aceita até 256 sessões no total, incluindo as encerradas, para limitar
pedidos remotos. Criar uma sessão em outra janela descarta a lista anterior em memória.

Uma falha de gravação ou comunicação é um erro, não uma confirmação. Não existe
uma transação atômica entre computadores: se B já confirmou e a última resposta
se perder, A pode continuar incompleto. Repita `completePairingRequest` com o
mesmo identificador enquanto a janela permitir. O registro incompleto de A não
é promovido automaticamente. Após reiniciar, sessões em memória são perdidas;
se só B ficou confiável, remova explicitamente esse registro em B com o model e
refaça o pareamento. Os peers confiáveis existentes não são apagados ao reiniciar.

## Contrato HTTP na porta temporária

Todas as rotas abaixo usam a porta 8444 durante a janela local, TLS 1.3 completo
e certificado de cliente. O certificado e o IP do remetente vêm do socket TLS,
nunca de cabeçalhos ou campos JSON fornecidos pelo remetente. O certificado de
uma sessão precisa continuar sendo exatamente o mesmo em todas as mensagens.

| Método e caminho | Query / corpo | Resposta |
| --- | --- | --- |
| `GET /connect` | Sem query ou corpo | `200` com `{ displayName, certificatePem }`. |
| `POST /connect/requests` | JSON `{ id, displayName, ttlMs }` | `201`, `Location: /connect/requests/<id>` e estado da sessão. Repetir o mesmo pedido conserva seu estado. |
| `GET /connect/requests/:id` | Sem query ou corpo | `200` com o estado; somente o participante registrado pode consultar. |
| `POST /connect/requests/:id/preparation` | JSON `{}` | `200` depois da preparação privada, ou `409 pairing_not_ready` se faltar o aceite local. |
| `POST /connect/requests/:id/confirmation` | JSON `{}` | `200` depois da confirmação e da recarga TLS; exige preparação e aceite anteriores. |
| `DELETE /connect/requests/:id` | JSON `{ reason: "rejected" ou "cancelled" }` | `200` depois de descartar a preparação local. Não remove confiança já concluída. |

O estado retornado entre participantes tem exatamente `{ id, status, accepted }`.
`accepted` informa o aceite local de quem respondeu, não concede aceite ao
remetente. Os dados são consultas da própria sessão, não uma lista de pedidos.

`id` precisa ser UUID v4; `ttlMs` é inteiro de 1 a 120000; `displayName` é texto
não vazio, Unicode válido e sem NUL. Corpos JSON exigem `application/json` em
UTF-8, têm limite de 16 KiB e não aceitam campos extras. Nenhuma rota aceita query.
Cada mensagem enviada pelo serviço tem prazo total de dois segundos e resposta
limitada a 16 KiB. Falhas são propagadas para que a ação local possa ser repetida.

Os erros HTTP usam Problem Details: `422 validation_failed`, `404 pairing_request_not_found`,
`403 pairing_peer_rejected`, `409 pairing_not_ready`, `pairing_conflict`,
`pairing_request_closed` ou `pairing_in_progress`, e `429 pairing_limit_reached`.
O limite de 99 registros privados produz `409 peer_limit_reached`. Uma falha de
armazenamento não classificada retorna `500 internal_error`, sem expor caminhos.

Sem certificado de cliente ou com certificado inválido, a conexão é encerrada.
As rotas de arquivos não existem nesse listener. O cliente do serviço valida a
cadeia TLS usando o certificado esperado e confere sua identidade exata, em vez
de usar o IP como nome de identidade. A API de arquivos continua exigindo somente
certificados confiáveis, com `rejectUnauthorized: true`.
