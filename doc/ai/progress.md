# Trabalho atual — documentação P2P

## Escopo e autorização

- Pedido atual: abandonar o plano de implementação anterior e trabalhar somente
  na documentação do passa-arquivo como módulo central P2P para Linux Mint,
  Ubuntu e Windows, com identidade persistente, TOFU e mTLS.
- Estado: primeira revisão documental concluída; **aguardando “continuar”**.
- O plano antigo está cancelado. Código, testes, dependências e configurações
  executáveis devem permanecer inalterados. Um novo plano de implementação só
  será elaborado quando o usuário pedir, depois da documentação.
- O histórico completo está em [history-before-p2p.md](history-before-p2p.md).
- Skill aplicada: `api-design-principles`, com foco em métodos HTTP, recursos,
  erros e separação entre descoberta, pareamento e operações de arquivos.

## Revisão documental

1. Preservar as lições de cada uma das nove etapas antigas; atualizar arquitetura,
   plataformas, segurança, conexão, persistência e referências afetadas.
   Conferir links, exemplos, coerência das regras e ausência de mudanças de código.
2. Depois de resolver os detalhes de interação e do protocolo, fechar o contrato
   de conexão e os fluxogramas dos endpoints, incluindo o fluxo de pareamento.
   Cada revisão termina com uma pausa
   para “continuar”; isso não reativa o plano de implementação abandonado.

A primeira revisão está autorizada pelo pedido atual. A segunda depende da
conclusão da primeira e de autorização, além das decisões essenciais aplicáveis.

## Decisões confirmadas durante a revisão

- O usuário confirmou que ambos ativam a descoberta.
- O usuário confirmou confiança nos dois sentidos: A salva B e B salva A.

## Detalhes ainda necessários para o contrato completo

- Nome final e divisão das rotas de descoberta e pareamento; proteção do comando
  local que ativa a janela de descoberta; duração e limites de varredura.
- Protocolo revisado para vincular o código aos certificados e à sessão; tamanho,
  validade e limite de tentativas do código. Não inventar criptografia própria.
- Perfil do certificado, política de troca/renovação e formato de armazenamento.

Esses detalhes não impedem registrar a arquitetura e seus limites nesta revisão.
Não foram apresentados como escolhas já aprovadas ou implementadas. O contrato
completo e a verificação dos fluxogramas continuam como revisão seguinte.

## Trabalho concluído

- Plano anterior cancelado nas instruções e no registro atual. Histórico integral
  preservado em `history-before-p2p.md`; resumo das nove etapas, distinção entre
  código concluído e desenho não executado, evidências e lições em
  `previous-plan-lessons.md`.
- Arquitetura e README atualizados: API central do software P2P em cada máquina,
  sem servidor central obrigatório; outros componentes futuros em branches órfãs.
- Novos guias: `connection.md`, `peers.md` e `platforms.md`.
- Segurança reescrita para identidade por instalação, persistência, TOFU com
  confirmação fora do canal, pareamento restrito e mTLS no uso normal.
- Descoberta exige ação dos dois usuários e não permanece disponível para novos
  pareamentos fora da janela. Aceite salva os dois certificados, conforme respostas
  explícitas do usuário.
- Registro de peer documentado com nome, certificado e horários; IP separado da
  identidade, troca de certificado e gravação parcial tratados explicitamente.
- Guias de rotas, erros, configuração, catálogo, filesystem e testes alinhados.
  O catálogo de opções ainda descreve o código real, sem anunciar suporte Windows
  ou identidade P2P já implementados.
- D13 registra as novas diretrizes e substituições. Nenhuma branch criada,
  varredura realizada, credencial gerada ou alteração executável feita.

## Verificações realizadas

- Conferidos 22 documentos autorais e 165 links/âncoras locais; cercas e
  formatação válidas. Treze páginas públicas sem os rótulos de processo pesquisados.
- Dezoito exemplos shell conferidos com `sh -n`, sem executar seu conteúdo;
  cinco exemplos JSON válidos.
- Dez operações de saúde/arquivos preservadas, `/connect` incorporado como nome
  provisório e 16 opções existentes ainda catalogadas.
- Hashes de código, testes, manifesto, lock e configuração executável idênticos
  aos do início da revisão. Especificação original preservada byte a byte.
- Diagrama Mermaid do código existente preservado. Não foram criados diagramas
  novos nesta revisão nem instaladas ferramentas para a revisão seguinte.
- `git diff --check` sem problemas. Nenhuma instalação ou teste da API executado.
- Fontes consultadas: RFC 8446, RFC 9382, RFC 9110, documentação TLS/filesystem
  do Node.js e nomes/caminhos Windows da Microsoft. Referências estão nos guias.

## Pausa e próxima ação

- Nada restante na primeira revisão arquitetural autorizada.
- Motivo da pausa: revisão concluída; próxima parte é o contrato de conexão e
  seus detalhes ainda abertos, seguida dos fluxogramas pertinentes.
- Um “continuar” autoriza somente a próxima revisão documental. Não autoriza
  código nem a retomada de qualquer etapa antiga.
- Ao terminar a documentação, aguardar o usuário solicitar o novo plano de
  implementação. Não o antecipar.
