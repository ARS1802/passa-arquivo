# Linux e Windows

O passa-arquivo será projetado para rodar nativamente no Linux Mint, no Ubuntu
e no Windows. Não deverá depender de WSL para funcionar no Windows.

O desenho exige compatibilidade nativa com as três plataformas. As versões
mínimas de cada sistema ainda precisam ser definidas.

## Caminhos na API e no computador

Na API, um caminho será sempre relativo à pasta compartilhada e usará `/`:
`documentos/nota.txt`. A raiz será `.`. Esse formato será igual nos dois sistemas.

No disco, os caminhos seguem o sistema local. A pasta compartilhada poderá ser
`/home/ana/Compartilhado` no Linux ou `C:\Users\Ana\Compartilhado` no Windows.
Esses são exemplos de caminhos nativos de cada sistema. O controller usa as
regras de caminho absoluto do ambiente em que executa; as áreas de estado e
staging são configuradas independentemente da raiz compartilhada.

O servidor deverá conferir cada segmento antes de convertê-lo para o caminho
local. Receber uma URL com `/` não torna seguro concatená-la à raiz. Caminhos
absolutos, `..`, nomes de dispositivos, namespaces especiais e tentativas de
acessar áreas reservadas precisam ser recusados.

## Diferenças que afetam os arquivos

| Assunto | Cuidado necessário |
| --- | --- |
| Nomes e maiúsculas | Não presumir que nomes que diferem apenas por maiúsculas identificam arquivos distintos em todo disco. Detectar conflito no destino, sem renomear silenciosamente. |
| Nomes inválidos | O Windows reserva nomes como `CON` e `NUL`, caracteres como `:` e formas terminadas em ponto ou espaço. Uma transferência pode precisar ser recusada mesmo que o nome exista na origem. |
| Links e atalhos do sistema de arquivos | A proteção precisa considerar links simbólicos e, no Windows, junctions e outros reparse points capazes de redirecionar acesso. |
| Arquivos abertos | Durante envio, cópia e movimentação, a aplicação não deverá impedir leitura ou edição por outros programas. O sistema operacional ainda pode recusar acesso, exclusão ou substituição conforme a forma como o arquivo foi aberto. A API deve informar a falha, preservando o destino anterior quando aplicável, sem forçar desbloqueio. |
| Discos diferentes | Não presumir que uma renomeação ou publicação funciona entre volumes. A área temporária precisa ser compatível com a operação no destino. |
| Caminhos longos | O limite depende do sistema e de sua configuração. Não prometer suporte sem verificação em cada plataforma. |

As restrições de nomes e namespaces estão descritas pela
[Microsoft](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file).
A política exata de portabilidade de nomes ainda precisa ser fechada; falhas não
devem ser escondidas por alterações automáticas no nome escolhido.

## Dados locais

Chave privada, certificados conhecidos, registros de peers e arquivos temporários
ficam fora da pasta compartilhada. Os padrões são `model/peer` e `tmp`, duas áreas
auxiliares; seus dados de execução são ignorados pelo Git. Também podem ser
configuradas áreas fora do projeto.

O model confere os tipos, os links e a localização real das entradas. A instalação deverá
preparar apenas os próprios dados, sem alterar
firewall, permissões de outras pastas ou certificados confiáveis do sistema.

## Rede e encerramento

A busca usará as interfaces e redes locais escolhidas pelo usuário. Ter um IP
privado não prova que um dispositivo pertence à rede desejada; a busca precisa
respeitar o conjunto explícito de destinos. VPNs e várias placas de rede podem
mudar esse conjunto.

Uma porta bloqueada ou ocupada deverá ser informada ao usuário. O programa não
encerrará outros processos nem mudará o firewall automaticamente.

O encerramento deverá funcionar pelos controles da aplicação e pelos mecanismos
de cada sistema. Sinais POSIX, isoladamente, não definem o comportamento no Windows.

## Compatibilidade a verificar

O funcionamento completo precisará ser conferido em Linux Mint, Ubuntu e
Windows, incluindo conexões Linux↔Linux, Linux↔Windows e Windows↔Windows.
Os testes deverão cobrir pareamento, reinício, mudança de IP, persistência,
permissões, nomes, links e falhas durante transferências. Isso ainda não foi testado.
