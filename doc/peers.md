# Dispositivos conhecidos

Um **peer** é outro dispositivo que usa o passa-arquivo. Encontrar um dispositivo
na rede não o torna conhecido: o registro confiável só nasce depois do
[pareamento](connection.md), com aceite e confirmação do código.

Os dois dispositivos guardarão o certificado um do outro. Reiniciar a aplicação
não apagará esses registros. A persistência ainda não existe no código atual.

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
expirado ou com código incorreto não pode criar um peer confiável.

A gravação local deverá evitar registros incompletos e preservar o arquivo
anterior em caso de falha. A aplicação só confirmará o sucesso local depois
de conseguir salvar os dados. Não existe uma gravação atômica entre os dois
computadores: se a conexão cair depois de apenas um lado salvar, a conclusão
precisará ser retomada pela mesma sessão verificada ou o pareamento repetido,
sem conceder confiança automaticamente ao lado incompleto.

Acesso a arquivos só será liberado quando a confirmação bilateral estiver
concluída. A forma de reconhecer uma repetição e recuperar uma gravação parcial
ainda precisa ser definida no protocolo.

Os registros ficarão em armazenamento privado. O formato em disco, a biblioteca,
o mecanismo de gravação e uma eventual ferramenta de banco de dados ainda não
foram escolhidos. Eles precisam funcionar nativamente nos dois sistemas.

## Remover confiança

Perda ou suspeita de cópia da chave privada precisa permitir remover a confiança
local. O efeito sobre conexões já abertas e a interface para essa remoção ainda
serão definidos. Apagar o registro em A não apaga automaticamente a cópia em B.
As chaves privadas nunca serão transferidas para um peer.
