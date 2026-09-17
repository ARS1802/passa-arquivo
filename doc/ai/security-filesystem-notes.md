# Notas da revisão de segurança e arquivos

Registro de 2026-09-17. Os guias públicos [security.md](../security.md) e
[filesystem.md](../filesystem.md) foram reescritos para retirar linguagem de
planejamento e simplificar explicações. O funcionamento descrito continua
previsto; nenhuma funcionalidade de segurança ou filesystem foi implementada
nesta revisão.

## Histórico retirado dos guias

- A etapa 2 implementou validação local de opções, diagnósticos sanitizados,
  exclusões Git e uma fábrica Express sem rotas ou listener. Não implementou
  autenticação, emissão de certificados, transporte HTTPS nem isolamento físico.
- O parser confere caminhos absolutos e relações lexicais; não acessa o disco,
  verifica permissões ou valida relações físicas com a raiz e o repositório.
- Nenhum token, chave ou certificado havia sido criado pelo trabalho registrado
  nos guias anteriores.
- O listener HTTPS e a validação da conexão real estavam vinculados à etapa 8.
  Testes internos anteriores não autorizam um listener HTTP de uso normal.
- Detecção adicional de montagens permanece decisão técnica a revisar antes
  da etapa 3. Primitivas de publicação e seus testes pertencem às etapas 5 e 7.
  Biblioteca e preparação de ZIP pertencem à etapa 7. A biblioteca de emissão
  de certificados continua sem escolha.
- Os rótulos de requisitos aprovados e propostas foram retirados dos guias.
  Os detalhes antes tratados como propostas continuam identificados no texto
  por expressões como “ainda está em definição”; a mudança de linguagem não
  constitui aprovação técnica nem autorização de implementação.

## Verificações de segurança pendentes

Ainda não executadas: autenticação ausente, inválida e válida em todas as rotas;
rejeição precoce de upload não autenticado; tokens temporários e externos;
separação e permissões do estado privado; tentativa de sair da raiz e links;
preservação de destino e limpeza; TLS real com confiança configurada; falhas por
validade, identidade e chave inadequadas; ausência de HTTP; preflight permitido;
falta de autorização CORS para origem não permitida; token obrigatório na
operação efetiva; ausência de segredos em erros.

## Verificações de arquivos pendentes

Ainda não executadas: caminhos relativos, absolutos e codificados; nulos e
espaços; raiz; links diretos, intermediários e recursivos; entradas especiais
e hard links; destinos existentes; ancestrais e descendentes; conflitos
concorrentes dentro do processo; interrupção de upload; preservação do destino;
ZIP com diretórios vazios e limites; limpeza e falhas parciais.

Essas verificações precisam usar certificados e diretórios exclusivos e
temporários, nunca dados reais do operador. Os procedimentos ficam em
[testing.md](../testing.md), e o histórico de execuções em
[progress.md](progress.md).
