# Sistema de arquivos

**Estado:** operações e isolamento do filesystem continuam planejados. Na etapa 2, o parser de configuração verifica apenas caminhos absolutos e relações lexicais entre opções, sem inspecionar o disco; isso não implementa as proteções de filesystem descritas abaixo. Requisitos do pedido estão identificados como aprovados; escolhas adicionais estão identificadas como propostas e devem ser confirmadas pela implementação e pelos testes da etapa correspondente. Consulte [progresso](progress.md), [contrato HTTP](endpoints.md), [erros](errors.md) e [configuração](configuration.md).

## Caminhos e representação das entradas

**Requisitos aprovados:** uma única raiz configurável; caminhos públicos relativos a ela; `/` como separador; `.` como identidade da raiz. O caminho de recursos REST é transmitido em `path` na query; ações recebem os campos JSON documentados em [endpoints](endpoints.md). Caminhos absolutos, segmentos `..`, nulos e formatos ambíguos são rejeitados antes da operação principal. Espaços legítimos são preservados.

**Proposta de sintaxe estrita:** validar a string resultante de uma única decodificação normal da URL. Os campos de JSON não passam por decodificação percentual. Não corrigir caminhos silenciosamente, não aplicar `trim`, não expandir `~` ou variáveis de ambiente, não normalizar Unicode. A tabela abaixo detalha a proposta de classificação:

| Entrada após decodificação | Resultado planejado |
| --- | --- |
| `.`, `documentos`, `documentos/nota.txt` | Sintaxe permitida; ainda exige validação da entrada real |
| `documentos/ nota final.txt ` | Espaços preservados, inclusive nas extremidades do nome |
| String vazia, `documentos//nota.txt`, `documentos/`, `./documentos`, `documentos/./nota.txt` | `400 invalid_path` |
| Qualquer byte nulo ou barra invertida em um caminho relativo | `400 invalid_path` |
| Caminho absoluto POSIX, de unidade Windows ou UNC; qualquer segmento `..` | `403 path_forbidden` para cliente autenticado |
| `...`, `.oculto`, `relatorio%20final.txt` | Nomes literais permitidos; `%20` remanescente não é decodificado novamente |

Formatos reconhecidos como absolutos ou tentativas de escape têm precedência sobre a classificação de barras invertidas como sintaxe inválida. A detecção desses formatos não anuncia suporte a Windows.

Na URL, `path=documentos%2Fnota%20final.txt` representa `documentos/nota final.txt`. `path=%2E%2E%2Fsegredo` é rejeitado como escape. `path=%252E%252E%252Fsegredo` resulta no nome literal `%2E%2E%2Fsegredo`, sem uma segunda decodificação. Para um sinal `+` literal, codificar `%2B`; os exemplos devem usar `URLSearchParams` ou a opção `--data-urlencode` do cliente HTTP.

O campo `name` de renomeação aceita exatamente um nome não vazio: exclui `.`, `..`, `/`, `\` e nulos. O campo `parentPath` segue a convenção de caminhos, inclusive `.`. Campos ausentes, tipos incorretos e opções desconhecidas seguem a validação de esquema em [erros](errors.md); um campo obrigatório ausente não equivale ao caminho vazio.

**Plataforma planejada:** Linux. As operações devem preservar nomes UTF-8 representáveis no contrato, espaços e distinção entre maiúsculas e minúsculas quando o filesystem a oferecer. Não se promete suporte a nomes formados por bytes que não constituam UTF-8 válido, nem compatibilidade com regras de nomes de Windows ou macOS. Limites de tamanho de nome e caminho dependem do filesystem; falhas devem ser traduzidas sem expor caminhos locais. Não esconder arquivos do operador somente por começarem com ponto.

**Metadados aprovados:** `type` é `file` ou `directory`; `size` é o tamanho em bytes de arquivo regular e `null` para diretório; não calcular tamanho recursivo. `modifiedAt` usa UTC padronizado. **Propostas:** formato ISO 8601 com sufixo `Z` e milissegundos; raiz com `name: "."` e `path: "."`. Respostas não incluem caminhos absolutos.

## Raiz, tipos de entrada e isolamento

**Requisitos aprovados:** resolver a raiz efetiva na inicialização; validar origem, destino e componentes intermediários; não usar comparação textual de prefixo como única proteção. A raiz nunca pode ser excluída, movida ou renomeada. Pode receber consulta de metadados, listagem, criação idempotente de diretório e compactação. Não pode ser origem de cópia no MVP.

**Proposta de preparação:** exigir raiz previamente existente e do tipo diretório. Resolver o caminho escolhido pelo operador uma vez, antes de validar a separação dos diretórios privados. Um eventual link na configuração inicial do operador determina essa raiz canônica; isso não autoriza links dentro dela. Verificar novamente a identidade da raiz quando pertinente durante operações e falhar se a estrutura necessária deixar de corresponder à configuração validada. Não criar uma raiz arbitrária devido a erro de digitação.

**Política aprovada de links simbólicos:** nenhuma operação sobre um link, mesmo quando seu destino está dentro da raiz; nenhuma travessia por componentes que sejam links; a regra inclui links quebrados e links encontrados em árvores de cópia ou ZIP. A exclusão recursiva também deve respeitar a política: não remover o link como uma exceção implícita.

**Propostas verificáveis:**

- Examinar componentes existentes sem seguir links, validar seu tipo e avaliar a contenção por componentes do caminho e pela resolução efetiva dos ancestrais. Destinos inexistentes exigem validação do ancestral existente antes de criar os segmentos permitidos.
- Admitir apenas arquivos regulares e diretórios; rejeitar dispositivos, sockets, FIFOs e demais tipos especiais com `403 entry_forbidden`.
- Rejeitar com `403 entry_forbidden` uma listagem que encontre um filho simbólico ou especial. Não omitir silenciosamente entradas nem inventar um terceiro valor de `type`.
- Rejeitar arquivos regulares com mais de um hard link detectável (`nlink > 1`), inclusive em percursos recursivos, com `403 entry_forbidden`. Isso reduz a exposição de um mesmo arquivo por nomes internos e externos; não prova isolamento contra criação concorrente de links.
- Restringir o MVP a um filesystem local; rejeitar uma travessia detectada para dispositivo diferente com `409 cross_device_operation`. A relação de origem e destino deve considerar identidade real, quando disponível, além dos segmentos textuais.

Essas verificações não identificam todas as configurações de montagem: bind mounts podem expor a mesma entrada por nomes diferentes sem alterar o dispositivo. A operação planejada pressupõe uma raiz sem montagens internas administradas por processos não confiáveis. Uma detecção adicional de montagens permanece uma decisão técnica a revisar antes da etapa 3; não existe isolamento de montagem implementado. `realpath` não fornece identidade única para hard links ou bind mounts, conforme a [documentação de filesystem do Node.js](https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisesrealpathpath-options).

Estado privado, credenciais, chaves e staging devem ficar fora da raiz efetiva e não ser alcançáveis por links ou aliases configurados pelo operador. A proposta é rejeitar sobreposição entre raiz, diretórios privados e repositório quando expuser arquivos internos, verificando relações de ancestralidade nos dois sentidos. Não usar uma lista de nomes ocultos como mecanismo principal de proteção. Consulte [configuração](configuration.md) para as restrições exatas desses diretórios.

## Comportamento das operações

A tabela sintetiza os **requisitos aprovados**, ainda planejados. Status, campos e exemplos completos constam em [endpoints](endpoints.md).

| Operação | Efeito planejado e conflitos |
| --- | --- |
| Metadados | Consulta arquivo regular ou diretório, inclusive a raiz; ausência resulta em `404` |
| Listagem | Somente filhos imediatos; diretórios antes de arquivos; sem recursão ou paginação; proposta de ordem nominal: comparação lexicográfica dos bytes UTF-8, sensível a caixa e independente de locale |
| Download | Apenas arquivo regular; streaming; nome seguro em `Content-Disposition`; tipo de conteúdo apropriado ou `application/octet-stream`; diretório não vira ZIP automaticamente |
| Upload | Exatamente uma parte de arquivo `file`; `path` determina destino completo; pai existente obrigatório; conteúdo novo em staging; cria arquivo com `201` ou substitui arquivo regular com `204`; diretório no destino resulta em `409` |
| Criação de diretório | Cria pais ausentes; novo diretório resulta em `201`; diretório já existente, inclusive `.`, resulta em `200` e preserva conteúdo; arquivo em componente necessário resulta em `409` |
| Exclusão | Exclui arquivo ou diretório vazio; diretório não vazio exige `recursive=true`, senão `409`; raiz proibida; sucesso `204`, ausência `404` |
| Renomeação e movimentação | `name` e/ou `parentPath`; destino pai existente; ambos os campos compõem uma única operação; omissão preserva valor atual; sem mudança efetiva resulta em `200`; não move raiz nem diretório para descendente |
| Cópia | Destino é caminho final completo, com pai existente; não acrescenta nome automaticamente; não copia raiz, mesma entrada ou diretório para descendente; cria com `201`; substituição permitida de arquivo resulta em `200` |
| Compactação | Apenas diretório, inclusive raiz; ZIP em streaming sem buffer integral; nomes relativos ao diretório solicitado; preserva diretórios vazios; não cria ZIP permanente ou job persistente |

**Sobrescrita aprovada:** upload substitui conteúdo deliberadamente; a substituição de destino existente em movimentação ou cópia exige `overwrite=true`, cujo padrão é `false`. Somente arquivo regular pode substituir arquivo regular. Não substituir diretório, mesclar árvores nem remover previamente o destino para tentar copiar em seguida. Nunca remover um ancestral que contenha a própria origem. Propostas de erro: modificação proibida da raiz resulta em `403 entry_forbidden`; mover diretório para descendente ou copiar para a mesma entrada/descendente resulta em `422 validation_failed`. PATCH para a identidade atual permanece `200`, sem alteração.

Repetir criação de diretório não esvazia seu conteúdo. Repetir upload mantém o conteúdo solicitado, embora metadados possam mudar. Uma segunda exclusão pode produzir `404` depois do primeiro `204`: idempotência descreve o efeito final pretendido, não a igualdade das respostas. Repetir cópia sem sobrescrita pode encontrar o destino criado e resultar em conflito.

## Staging, publicação e limpeza

**Requisitos aprovados:** upload e cópia devem preservar o destino anterior quando houver falha antes da publicação. Receber/processar por streaming em staging privado, validar por completo e só então publicar. A limpeza só pode remover temporários pertencentes à própria operação. Desconexão deve cancelar streams e limpar recursos. Temporários não podem aparecer em listagem, download, cópia ou ZIP da raiz.

**Proposta de publicação:** staging externo à raiz, configurado no mesmo filesystem do destino, com diretórios privados de modo `0700` e arquivos privados de modo `0600`. Cada operação recebe um espaço próprio criado de modo exclusivo e não previsível. Verificar origem, pai, tipo e conflito novamente antes de publicar. Uma cópia de diretório é montada integralmente em staging antes de publicar o novo nome; o destino anterior não é removido antecipadamente.

A escolha da primitiva de publicação e seus testes pertence às etapas 5 e 7. Não tratar uma checagem prévia de existência seguida de renomeação como garantia de não sobrescrever diante de processos externos. Rejeitar `EXDEV` com `409 cross_device_operation`; não executar cópia seguida de exclusão como fallback de movimentação. Se a localização configurada de staging já impossibilitar publicação, falhar na preparação com diagnóstico local sanitizado.

Após publicação bem-sucedida, uma falha na entrega da resposta não desfaz o conteúdo publicado. Na interrupção anterior à publicação, descartar apenas o novo staging e manter o arquivo anterior. Encerramento normal deve aguardar/cancelar operações conforme [configuração](configuration.md). Encerramento abrupto ou falha do sistema pode deixar temporários; eventual limpeza na próxima preparação deve se restringir a espaços comprovadamente criados pelo servidor. Não apagar genericamente o diretório temporário do operador.

**Compactação:** limites de quantidade de entradas e volume são configuráveis. **Proposta:** contar cada arquivo e diretório descendente, incluindo diretórios vazios; o diretório solicitado é o contêiner e não conta como uma entrada extra. Volume é a soma dos bytes não comprimidos efetivamente lidos dos arquivos, não o tamanho final do ZIP. Contadores devem ser aplicados durante o processamento, mesmo após uma estimativa prévia. Limite excedido antes dos headers resulta em `413 payload_too_large`; depois dos headers, abortar a transferência conforme [erros](errors.md). Descartar staging eventualmente utilizado após sucesso, falha ou desconexão. Seleção da biblioteca e estratégia de preparação ficam para a etapa 7.

## Concorrência e alcance das garantias

**Requisito aprovado:** um único processo; nenhuma exigência de múltiplos workers. **Proposta:** serializar trechos de mutação e de validação/publicação conflitantes com exclusão mútua dentro do processo; uma solução simples por raiz é preferível inicialmente. Receber um upload em staging não deve modificar seu destino antecipadamente. A estratégia de concorrência das leituras e árvores será verificada junto das respectivas operações.

Operações assíncronas de filesystem não se tornam sincronizadas apenas porque usam Promises. Verificação prévia e operação posterior deixam uma janela para alteração externa; recursos como abertura sem seguir o link final e inspeção do descritor podem reduzir riscos específicos, mas não demonstram proteção completa dos ancestrais. Essas limitações são descritas pela [documentação do Node.js](https://nodejs.org/docs/latest-v24.x/api/fs.html#promises-api).

O contrato planejado não oferece snapshot de toda uma árvore, proteção absoluta contra outros processos, transação entre vários arquivos ou durabilidade após queda de energia. Uma publicação de nome no mesmo filesystem pode ter garantias diferentes de uma operação recursiva; elas só serão anunciadas após validação da primitiva e da plataforma utilizadas.

| Situação | Limitação planejada |
| --- | --- |
| Upload/cópia falha antes de publicar | Destino anterior preservado; staging próprio removido quando o processo consegue executar a limpeza |
| Criação de vários diretórios pais falha | Pais já criados podem permanecer; não remover diretórios que possam ter recebido conteúdo |
| Exclusão recursiva falha | Algumas entradas podem já ter sido excluídas; não existe rollback ou lixeira |
| Download/ZIP durante escrita externa | Não há promessa de snapshot; detectar falhas quando possível e encerrar transferência |
| Processo externo altera links/nomes/montagens | Mutex da aplicação não oferece proteção contra esse processo |
| Falha após publicação ou resposta iniciada | Não garantir reversão; não trocar resposta já iniciada por JSON |

O operador precisa manter a raiz e seus ancestrais sob controle confiável para esse modelo. Não oferecer este MVP como sandbox contra usuários locais hostis. Filesystems de rede, diferenças de montagem e outras plataformas exigem verificações próprias antes de anunciar suporte.

## Verificações previstas

Ainda não executadas: caminhos relativos/absolutos/codificados; nulos e espaços; raiz; links diretos, intermediários e recursivos; entradas especiais e hard links; destinos existentes; ancestrais/descendentes; conflitos concorrentes dentro do processo; interrupção de upload; preservação do destino; ZIP com diretórios vazios e limites; limpeza e falhas parciais. Usar somente diretórios temporários exclusivos, nunca dados reais do operador. A matriz e o estado de execução ficam em [testes](testing.md).
