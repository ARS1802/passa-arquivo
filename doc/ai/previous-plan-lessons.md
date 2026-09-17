# Lições e pontos reutilizáveis do plano abandonado

O usuário cancelou o plano anterior ao redefinir o projeto como P2P com TOFU,
mTLS e suporte nativo a Linux e Windows. Este arquivo preserva conhecimento;
não é um plano de execução nem uma lista de etapas a retomar.

Somente as etapas 1 e 2 antigas foram concluídas. Nas demais, os pontos abaixo
são cuidados de projeto discutidos, não conclusões de uma implementação testada.
O histórico integral está em [history-before-p2p.md](history-before-p2p.md).

| Etapa antiga | O que existia | Ponto crítico e lição para reutilização |
| --- | --- | --- |
| 1 — Documentação e instruções | Guias, contrato e decisões | Separar requisito, hipótese e comportamento real. O leitor precisa de explicações simples; progresso e autorizações ficam em `doc/ai/`. Preservar exemplos e conferir links após mudanças. |
| 2 — Estrutura e configuração | TypeScript/Express/Zod, lock, CLI, configuração e testes | `loadConfig(argv, env)` separa validação de efeitos no disco e na rede. CLI tem prioridade sobre ambiente e padrão. Tipos estáticos não validam entradas em execução. Aceitar um caminho não prova isolamento físico. |
| 3 — Autenticação e caminhos | Apenas desenho | A autenticação deve anteceder operações de arquivos. Comparar prefixos de strings não protege a raiz; verificar componentes, links e caminhos privados. Bearer foi substituído pelo modelo de certificados entre peers. Linux e Windows exigem mecanismos distintos. |
| 4 — Saúde, metadados, listagem e download | Apenas contrato | Metadados precisam de formato comum; `size: null` evita prometer tamanho recursivo de pastas. Transferir por partes e tratar falhas antes/depois dos cabeçalhos. Leitura concorrente não garante um retrato fixo dos dados. |
| 5 — Pastas e upload | Apenas contrato | Receber em área privada antes de publicar; falha anterior à publicação preserva destino. Repetir PUT de pasta mantém conteúdo. Pais criados antes de uma falha podem permanecer. |
| 6 — Exclusão e movimentação | Apenas contrato | Proteger a raiz; exigir exclusão recursiva explícita. Renomear e mover formam um único destino. Não substituir movimentação entre sistemas de arquivos por cópia seguida de exclusão sem garantia equivalente. |
| 7 — Cópia e ZIP | Apenas contrato | Montar cópia antes de substituir destino. Não misturar árvores. ZIP precisa de limites durante a leitura, nomes relativos, pastas vazias e limpeza. Não carregar arquivos inteiros em memória. |
| 8 — HTTPS, certificados e CORS | Apenas desenho; sem servidor | Confiança precisa ser verificada em conexões reais. CORS não autentica peers. Certificados agora são identidades persistentes: regenerá-los em cada início ou ao mudar o IP destruiria a confiança. Pareamento deve ser isolado do acesso a arquivos. |
| 9 — Revisão final | Não iniciada | Conferir contrato, código e testes juntos. Um teste ignorado não demonstra suporte. Linux↔Windows, mudança de IP, reinício, erro de código e troca de certificado precisam de evidência própria. |

## Evidência que pode ser reutilizada

- Fontes existentes: `src/app.ts`, `src/check-config.ts`, `src/config/index.ts`.
- Ambiente anteriormente verificado: Linux x86_64, Node.js 24.19.0/npm 11.17.0.
- A última execução registrada de `npm run check` teve 46 testes aprovados:
  42 de configuração e quatro de bootstrap. Isso não verifica P2P, TLS ou Windows.
- Manifesto restringe instalação a Linux, e configuração usa caminhos POSIX.
  Preservar o código não significa considerá-lo pronto para os novos requisitos.
- Detalhes de versões, lock e verificações estão em
  [verification-history.md](verification-history.md).

## Premissas que não devem ser reaplicadas

- Linux como única plataforma do produto.
- Bearer como identidade dos peers e tokens descartáveis a cada execução.
- mTLS e persistência de peers fora do escopo.
- Troca de certificado causada apenas por mudança de endereço IP.
- Renovação automática de identidade em 30 dias, com margem de sete dias,
  sem protocolo de continuidade da confiança. Esses números eram hipóteses.
- `0600`/`0700` como prova de privacidade no Windows.
- Um simples hash ou envio de código em um canal não autenticado como garantia
  contra intermediário. A confirmação precisa estar vinculada aos certificados
  e à sessão por um protocolo revisado.

O usuário solicitará um novo plano de implementação depois da documentação.
