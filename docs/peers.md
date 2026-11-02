# Dispositivos conhecidos

Um **peer** é outro dispositivo que usa o passa-arquivo. Encontrar um dispositivo
na rede não o torna conhecido: o registro confiável só nasce depois do
[pareamento](connection.md), com aceite e conferência dos certificados.

Os dois dispositivos guardarão o certificado um do outro. Reiniciar a aplicação
não apagará esses registros. O model implementa essa persistência; o controller prepara o registro após o
aceite e só publica confiança depois das confirmações de gravação.

## Dados de cada peer

Os nomes abaixo descrevem o modelo de dados; não representam uma rota de cadastro
já disponível.

| Campo | Conteúdo | Regra |
| --- | --- | --- |
| `displayName` | Nome do dispositivo ou usuário | Texto para exibição. Pode mudar e não serve para autenticar o peer. |
| `certificatePem` | Certificado público do peer | Guardado integralmente após a confirmação; nunca inclui a chave privada remota. |
| `firstConnectedAt` | Data e hora da primeira conexão confiável | Gravada quando o pareamento termina com sucesso e a confiança é persistida; não é a hora da primeira resposta a uma varredura. |
| `lastConnectedAt` | Data e hora da última conexão autenticada | Atualizada após uma nova conexão mTLS aceita. Tentativas recusadas e anúncios de descoberta não atualizam esse campo. |

As datas serão registradas em UTC, em formato como `2026-09-17T14:30:00.000Z`.
Na primeira conexão bem-sucedida, os dois horários terão o mesmo valor local.
Cada máquina registra os próprios horários; não se presume que os relógios de A
e B estejam perfeitamente sincronizados. A precisão depende do relógio do sistema.

## Certificado é identidade; IP é endereço

O registro será localizado pelo certificado, não pelo nome ou pelo IP. Um resumo
criptográfico do certificado, por exemplo SHA-256 de sua representação DER,
poderá servir como índice; o formato desse identificador ainda será fechado.

O último IP conhecido poderá ser mantido como uma dica de localização, sem ser
usado como prova de identidade. Um endereço novo só poderá ser associado ao peer
depois de verificar seu certificado e a posse da chave correspondente.

Dois dispositivos com o mesmo nome continuarão sendo peers distintos. Um
certificado diferente no mesmo IP não herdará a confiança anterior. Renovar um
certificado ou trocar a chave exigirá um procedimento explícito de continuidade
da confiança ou um novo pareamento; esse procedimento ainda está em definição.

## Gravação e falhas

Solicitações pendentes ficam separadas dos peers confiáveis. Um pedido recusado,
expirado ou com impressão digital incorreta não pode criar um peer confiável.

A gravação local deverá evitar registros incompletos e preservar o arquivo
anterior em caso de falha. A aplicação só confirmará o sucesso local depois
de conseguir salvar os dados. Não existe uma gravação atômica entre os dois
computadores: se a conexão cair depois de apenas um lado salvar, a conclusão
precisará ser retomada pela mesma sessão verificada ou o pareamento repetido,
sem conceder confiança automaticamente ao lado incompleto.

Acesso a arquivos só será liberado quando a confirmação bilateral estiver
concluída. A sessão identifica as repetições. O iniciador pode repetir a conclusão enquanto
a janela estiver disponível; a [documentação do fluxo](connection.md) explica
o caso em que a última resposta se perde.

O armazenamento privado atual usa `index.csv` e diretórios de `01` a `99`, cada
um com `certificado.cert`. O índice relaciona `directory`, `displayName`,
`ipAddress`, `firstConnectedAt`, `lastConnectedAt`, `pairingId` e `status`. O estado
padrão fica em `model/peer`, separado da raiz compartilhada. O estado `pending`
representa uma preparação, e `trusted` representa confiança publicada localmente.

## Remover confiança

Perda ou suspeita de cópia da chave privada precisa permitir remover a confiança
local. O efeito sobre conexões já abertas e a interface para essa remoção ainda
serão definidos. Apagar o registro em A não apaga automaticamente a cópia em B.
As chaves privadas nunca serão transferidas para um peer.

## Preparação e confirmação no model

O formato atual preserva os diretórios numerados e o certificado por peer. As
colunas adicionais do CSV são:

| Campo | Conteúdo |
| --- | --- |
| `pairingId` | UUID v4 da sessão que preparou o registro. Vazio nos registros legados. |
| `status` | `pending` para preparação sem acesso; `trusted` para confiança publicada. |

`preparePeer(input, pairingId)` cria ou reencontra a preparação da mesma sessão.
`confirmPeer(certificatePem, pairingId)` publica somente a preparação correspondente.
`discardPreparedPeer(certificatePem, pairingId)` remove apenas a preparação desta
sessão; nunca remove confiança já concluída. O controller confere identidade,
aceites e mensagens; o model cuida do índice e dos certificados.

Por exemplo: A preparou o certificado de B na pasta `01`, mas B ainda não aceitou.
A linha fica `pending`. `listPeers()` e `findPeer()` não devolvem esse registro,
e ele não entra na lista TLS do servidor de arquivos. Se B aceitar e as etapas
terminarem, a mesma pasta passa a `trusted`; não é criado outro peer.

Preparações ocupam posições entre 01 e 99. Reiniciar o model remove somente os
registros `pending`, pois os aceites e a sessão em memória não sobrevivem ao
processo. Certificados e registros já confiáveis são preservados. O índice antigo,
com cinco colunas, é aceito como confiança já existente; uma próxima gravação
publica o cabeçalho novo, sem regenerar identidades ou apagar peers confiáveis.

Os horários expostos de um novo peer são fixados quando ele passa a confiável;
as datas anteriores de uma preparação são provisórias e não aparecem em consultas
normais. Repetir a confirmação não altera o primeiro horário. O contrato público
`Peer` permanece sem os campos privados de estado e sessão.

Não há transação atômica entre dois computadores. B pode ter concluído sua
confiança enquanto A perdeu a última resposta. A não retorna sucesso nesse caso
nem promove seu registro incompleto automaticamente. Uma falha local também é
propagada, mesmo que a outra ponta já tenha terminado. A recuperação e os limites
da repetição estão em [Conexão](connection.md#recusa-expiração-e-repetição).
