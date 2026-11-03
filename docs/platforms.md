# Linux e Windows

O passa-arquivo tem como alvo Linux Mint, Ubuntu e Windows nativo, sem depender
de WSL. O model possui tratamento de permissões POSIX e de ACLs do Windows.
A implementação Windows requer disco local NTFS e Windows PowerShell 5.1.

As verificações executadas nesta alteração foram feitas no Linux. As ACLs e a
comunicação Linux ↔ Windows ainda exigem execução em Windows real; compilar ou
simular regras de caminhos não comprova essa compatibilidade completa.

## Caminhos na API e no computador

Na API, um caminho será sempre relativo à pasta compartilhada e usará `/`:
`documentos/nota.txt`. A raiz será `.`. Esse formato será igual nos dois sistemas.

No disco, os caminhos seguem o sistema local. A pasta compartilhada poderá ser
`/home/ana/Compartilhado` no Linux ou `C:\Users\Ana\Compartilhado` no Windows.
Esses são exemplos de caminhos nativos de cada sistema. O controller usa as
regras de caminho absoluto do ambiente em que executa. No Windows, as comparações
usam as regras nativas de maiúsculas para conferir igualdade, contenção e
tentativas de copiar ou mover uma pasta para dentro dela mesma.

O servidor deverá conferir cada segmento antes de convertê-lo para o caminho
local. Receber uma URL com `/` não torna seguro concatená-la à raiz. Caminhos
absolutos, `..`, nomes de dispositivos, namespaces especiais e tentativas de
acessar áreas privadas precisam ser recusados.

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

## Dados privados

Chave privada, certificados conhecidos, registros de peers e arquivos temporários
ficam fora da pasta compartilhada. Os padrões são `model/peer` e `tmp`, duas áreas
privadas permitidas dentro do repositório; seus dados de execução são ignorados
pelo Git. Também podem ser configuradas áreas privadas fora do repositório.

No Linux, permissões como `0600` para arquivos e `0700` para pastas podem limitar
o acesso ao dono. No Windows, essa proteção exige listas de controle de acesso
(ACLs) apropriadas. Aplicar somente `chmod` não cria a mesma proteção: a API do
Node.js tem limitações específicas de permissões no Windows.
[Documentação de arquivos do Node.js](https://nodejs.org/api/fs.html#fschmodpath-mode-callback).

No Linux, o model continua conferindo dono e permissões POSIX. No Windows,
`Directory.openPrivate` cria diretórios privados com uma ACL que permite controle
total somente ao usuário atual, com herança para os filhos. A raiz privada é
protegida contra herança de permissões da pasta acima dela. A cada inspeção, o
model confere o dono e as regras de acesso da raiz e dos componentes usados.

Nas áreas padrão `model/peer` e `tmp`, a inicialização pode ajustar a ACL da raiz
quando ela pertence ao usuário atual. Outros diretórios privados já existentes
precisam ter a proteção correta; a aplicação não troca seu dono nem abre uma
exceção para permissões amplas. Diretórios novos são criados com a ACL antes da
gravação de certificados ou conteúdo recebido. Os filhos precisam herdar as
permissões privadas ou ter regras equivalentes aceitas pela conferência.

A integração fica em `model/file/Directory.ts` e usa as APIs de segurança do
Windows pelo PowerShell 5.1 do sistema. O código PowerShell é fixo; os caminhos
são enviados como dados JSON pela entrada padrão. Não há interpolação de nomes
em comandos, carregamento de perfil ou alteração de ExecutionPolicy. O processo
auxiliar é reaproveitado entre consultas e encerrado após um segundo inativo;
cada consulta tem limite de dez segundos. Falha ou ausência desse recurso impede
a operação, sem substituir ACLs por uma checagem de chmod.

O Windows também confere o atributo `ReparsePoint` dos caminhos utilizados.
Junctions, links e outros itens com esse atributo são recusados; isso inclui
pastas sincronizadas que dependam de reparse points. Use áreas locais NTFS sem
esses redirecionamentos. FAT, exFAT, volumes de rede e outros formatos não são
aceitos por essa implementação. Isso mantém as exigências de ACL e de publicação
por hard link, sem inventar uma cópia alternativa menos protegida.

A instalação prepara apenas seus dados, sem alterar firewall, permissões de
outras pastas ou certificados confiáveis do sistema. As verificações não tornam
a aplicação uma barreira contra administradores ou alterações locais maliciosas.

Referências: [Get-Acl](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1),
[proteção da herança](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectsecurity.setaccessruleprotection?view=netframework-4.8.1)
e [atributos de arquivos](https://learn.microsoft.com/en-us/dotnet/api/system.io.fileattributes?view=netframework-4.8.1).

## Iniciar no Windows

Use uma conta normal do Windows, dona das pastas da instalação, e execute os
comandos no PowerShell a partir da raiz do repositório. Em uma instalação
nova, execute antes `npm ci` no próprio Windows, para selecionar os pacotes
nativos já registrados no lock; não reutilize `node_modules` de outro sistema.

```powershell
npm run build:backend
npm run start:backend
```

Os caminhos padrão são `%USERPROFILE%\passa-arquivo`, com sufixo se o nome estiver
ocupado, `model\peer` para estado e `tmp` para staging. Se houver caminhos ativos
no `.env`, eles devem ser absolutos e válidos nesse computador. Por exemplo:

```dotenv
PASSA_ROOT=C:\Users\Arthur\Compartilhado
PASSA_HOST=0.0.0.0
```

A raiz explícita precisa existir. `PASSA_HOST=0.0.0.0` permite receber conexões
IPv4 de outra máquina; a configuração padrão `127.0.0.1` aceita somente conexões
locais. Ajuste o nome do usuário e a pasta do exemplo. Não é necessário criar
manualmente as áreas privadas: o model prepara as que ainda não existem.

Para consultar as permissões, sem ler a chave privada:

```powershell
Get-Acl -LiteralPath .\model\peer | Format-List Owner, AreAccessRulesProtected, Access
Get-Acl -LiteralPath .\model\peer\tls\server.key | Format-List Owner, Access
```

O dono deve ser o usuário que executa o backend. A raiz deve ter
`AreAccessRulesProtected=True`, e as regras devem conceder controle total somente
a esse usuário. Ajuste os caminhos se usar outro `state-dir`. Uma identidade
incompleta ou expirada continua causando erro; o suporte Windows não autoriza
regenerar chaves nem descartar pareamentos automaticamente.

## Rede e encerramento

A busca usará as interfaces e redes locais escolhidas pelo usuário. Ter um IP
privado não prova que um dispositivo pertence à rede desejada; a busca precisa
respeitar o conjunto explícito de destinos. VPNs e várias placas de rede podem
mudar esse conjunto.

Para IPv6 link-local, o controller usa o `scopeid` numérico da interface na
escuta temporária e nas conexões de descoberta e pareamento, como `fe80::2%17`.
Esse número é local ao sistema; não entra no certificado nem é persistido no IP
do peer. O nome escolhido pelo usuário, como `Wi-Fi`, serve para selecionar a
interface real. Não é colocado diretamente no endereço enviado ao socket.

Uma porta bloqueada ou ocupada deverá ser informada ao usuário. O programa não
encerrará outros processos nem mudará o firewall automaticamente.

O encerramento deverá funcionar pelos controles da aplicação e pelos mecanismos
de cada sistema. Sinais POSIX, isoladamente, não definem o comportamento no Windows.

## Compatibilidade a verificar

O funcionamento completo precisará ser conferido em Linux Mint, Ubuntu e
Windows, incluindo conexões Linux↔Linux, Linux↔Windows e Windows↔Windows.
Os testes deverão cobrir pareamento, reinício, mudança de IP, persistência,
permissões, nomes, links e falhas durante transferências. O roteiro nativo Windows
e os resultados já executados estão em [Testes](testing.md#suporte-windows).
