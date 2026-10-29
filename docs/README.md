# Documentação

Para preparar o projeto pela primeira vez, comece pela [descrição do projeto](descricao.txt).
Depois, escolha o guia de acordo com o que você quer entender.

A API será o módulo central P2P do passa-arquivo, para Linux Mint, Ubuntu e
Windows. Comece pela arquitetura e pelo fluxo de conexão. Descoberta, mTLS e
registro de peers ainda são responsabilidades previstas para o projeto.

| Guia | O que você encontra |
| --- | --- |
| [Arquitetura P2P](architecture.md) | Papel da API, componentes do sistema e separação entre controle local e conexões entre peers. |
| [Arquitetura MVC e tecnologias](architecture.md#arquitetura-mvc-e-tecnologias) | Organização em `controller`, `model` e `GUI`, com TypeScript, Express, Vite e Zod. |
| [Conectar dispositivos](connection.md) | Descoberta temporária, redes da busca, solicitação, código e aceite bilateral. |
| [Dispositivos conhecidos](peers.md) | Nome, certificado, primeira conexão e última conexão de cada peer. |
| [Linux e Windows](platforms.md) | Requisitos de caminhos, permissões, rede e execução nativa nas plataformas-alvo. |
| [Configuração](configuration.md) | Versões necessárias, comandos e opções como pasta compartilhada, endereço e porta. |
| [Rotas da API](endpoints.md) | Para que serve cada rota, o que enviar na requisição e qual resposta esperar. |
| [Erros](errors.md) | Formato das respostas de erro e significado dos códigos usados pela API. |
| [Módulos e funções](classes.md) | O que cada arquivo de código faz, quais funções oferece e onde elas são usadas. |
| [Arquivos e pastas](filesystem.md) | Regras para caminhos e operações como enviar, mover, copiar e excluir arquivos. |
| [Segurança](security.md) | Identidade criada na instalação, TOFU, código de confirmação e mTLS. |
| [Testes](testing.md) | Como conferir o projeto e quais comportamentos os testes verificam. |
