# Instruções permanentes

## Consulta obrigatória

Antes de atender cada mensagem, leia este arquivo, [README.md](README.md),
[doc/README.md](doc/README.md) e [doc/progress.md](doc/progress.md). Leia também
os documentos pertinentes e confira a implementação quando a resposta depender
do comportamento real. Preserve trabalhos existentes e alterações do usuário.

A especificação original está preservada em [doc/requirements.md](doc/requirements.md).
Requisitos aprovados, propostas técnicas e comportamentos implementados são estados
diferentes: não transforme uma hipótese discutida em decisão aprovada.

## Autorização por etapa

1. Divida toda implementação, correção, refatoração ou mudança de comportamento
   em etapas pequenas, coerentes e verificáveis. Apresente objetivo, resultado,
   verificações, documentos afetados e decisões essenciais pendentes antes de começar.
2. Registre o planejamento em `doc/progress.md` ao iniciar a primeira etapa.
   O pedido inicial autoriza somente a primeira etapa apresentada, depois de
   resolvidas decisões essenciais e desde que não exista pausa vigente.
3. Complete código, verificações e documentação pertinentes à etapa autorizada.
   Não solicite nova permissão para ações que já pertençam a essa etapa.
4. Ao concluir uma etapa, informe mudanças e resultados efetivamente verificados,
   atualize os documentos afetados e `doc/progress.md`, encerre a execução e
   **aguarde “continuar” antes de iniciar a próxima etapa**.
5. Cada “continuar” explícito autoriza somente retomar o restante da etapa
   interrompida OU iniciar a próxima etapa quando a anterior estiver concluída.
   Nunca autoriza ambas, nem todas as etapas restantes.
6. “Entendi”, “certo”, “obrigado”, ausência de perguntas, tempo decorrido e a palavra
   “continuar” dentro de pergunta, citação ou exemplo não autorizam avanço.
7. Não antecipe código, instalações, configuração executável, testes, refatorações
   ou preparações de etapas futuras durante a espera. Subdivisões justificadas
   não podem eliminar pausas nem ampliar a autorização.

## Perguntas durante implementação

- **Interrompa a implementação assim que receber uma pergunta do usuário.**
- Encerre com segurança apenas uma operação indivisível já iniciada. Não termine
  a funcionalidade inteira e não inicie novas alterações, instalações ou testes.
- Suspenda também agentes auxiliares e tarefas de implementação em segundo plano.
- Registre o ponto de interrupção em `doc/progress.md`, responda objetivamente e
  aguarde “continuar”. Responder à pergunta não autoriza retomar.
- Novas perguntas mantêm a pausa. Uma decisão explícita pode atualizar o plano,
  mas não remove a necessidade de autorização para a retomada.

Durante a espera, faça somente leituras necessárias às respostas e atualizações
documentais motivadas por decisões explícitas, esclarecimentos relevantes ou
correções factuais. Não implemente alternativas só porque foram discutidas.
Sem implementação pendente, converse normalmente; perguntas conceituais não são
pedidos de implementação e não exigem “continuar” para conversar.
Cancelamento ou redefinição explícita substitui a tarefa, mantendo o mecanismo de
etapas para a nova implementação.

## Registro e retomada

`doc/progress.md` deve identificar etapa atual, trabalho concluído e restante,
verificações executadas, decisões pendentes, bloqueios, motivo da pausa, próxima
ação autorizável e estado explícito **aguardando “continuar”**, quando aplicável.
Antes de retomar, consulte esse registro e as decisões tomadas durante perguntas;
retome do ponto registrado sem repetir trabalho concluído ou ultrapassar a etapa.
Distinga: etapa em andamento; etapa interrompida por pergunta; etapa concluída
aguardando autorização; conversa explicativa sem implementação pendente.

## Tecnologia e escopo

- Escolha do usuário: **TypeScript, Express e Zod**. Zod valida dados em execução;
  TypeScript fornece tipagem estática. Linux é a plataforma inicial.
- Consulte documentação oficial, use runtime estável e suportado e registre versões.
  Dependências e lock pertencem à etapa 2 ou à etapa da funcionalidade que as exigir.
- Não instale ferramentas globalmente nem altere o sistema operacional, firewall
  ou certificados confiáveis dos clientes. Não mate processos para liberar portas.
- Implemente somente o escopo de [requirements.md](doc/requirements.md).
  Não acrescente frontend, banco, usuários, permissões individuais, autenticação
  adicional, serviços de nuvem, compatibilidade antiga ou funcionalidades futuras.
- HTTPS é obrigatório na execução normal; não disponibilize fallback HTTP.
  Testes internos sem rede nas etapas intermediárias não autorizam listener HTTP.
- Nunca utilize dados reais do operador em testes. Use diretórios e certificados
  temporários exclusivos. Tokens, chaves e staging ficam privados, fora da raiz
  compartilhada, e não podem ser versionados nem expostos pela API.
- Não prometa isolamento, atomicidade ou compatibilidade de plataforma sem
  implementação e verificação correspondentes. Documente limites de concorrência.
- Separe HTTP, autenticação, aplicação, caminhos, filesystem, configuração e erros
  com estrutura simples; não crie abstrações ou classes sem responsabilidade concreta.

## Documentação e verificação

Após alterações, atualize todos os documentos afetados, exemplos e referências a
arquivos/símbolos; confira consistência entre contrato, código e testes. Nenhuma
etapa termina com documentação ou verificação pertinente pendente.
Mantenha o README curto e o catálogo técnico em `doc/`.
Documente todos os endpoints expostos em `doc/endpoints.md` e todas as unidades de
produção em `doc/classes.md`, mesmo quando forem funções, módulos ou interfaces.
Não invente símbolos para preencher o catálogo. Marque explicitamente o planejado.

Os procedimentos e resultados de verificação estão em [doc/testing.md](doc/testing.md).
Na etapa 2, com Node.js de `.nvmrc` selecionado e dependências locais preparadas,
`npm run check` verifica tipos, compila e executa a suíte existente. `npm ci` é a
preparação com lock. `npm run check:config -- ...` confere somente opções e não
inicia servidor; não o apresente como verificação física de arquivos ou de TLS.
Execute as verificações apropriadas à etapa, sem alegar testes não executados.
Se houver impedimento, registre exatamente o teste e o motivo.
Não declare a API concluída porque uma etapa terminou.

## Comunicação

Use português claro e didático, adequado a estudante do terceiro semestre de
Ciência da Computação com experiência júnior. Explique primeiro o essencial e o
motivo das decisões. Contexto histórico deve ajudar a compreender a tecnologia;
não invente atualizações recentes nem acrescente histórico irrelevante.
Na documentação técnica, use linguagem precisa e verificável; reserve explicações
cotidianas dos endpoints à seção “Exemplo em linguagem humana”.
