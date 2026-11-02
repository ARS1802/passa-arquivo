# GUI do passa-arquivo

A GUI usa JavaScript, React e Vite. Atualmente, exibe a tela inicial do Vite,
com links e um contador.
Ainda não há telas de arquivos, descoberta ou pareamento.

- `src/App.jsx`: componente da tela inicial e estado local do contador.
- `src/main.jsx`: montagem do React no elemento `root` de `index.html`.
- `src/App.css` e `src/index.css`: estilos do componente e da página.
- `api.js`: local previsto para a comunicação com o controller; só contém comentários.
- `vite.config.js`: configuração do Vite com o plugin React.

Execute a partir da raiz do repositório:

| Comando | Resultado |
| --- | --- |
| `npm run dev:gui` | Inicia o servidor de desenvolvimento; abra o endereço mostrado no terminal. |
| `npm run build:gui` | Gera o build em `GUI/dist`. |
| `npm run preview:gui` | Serve o build já gerado para conferência local. |
| `npm run lint:gui` | Executa as regras de análise estática configuradas no Oxlint. |

O backend possui comandos separados e exige mTLS para peers conhecidos.
Iniciá-lo não conecta esta tela à API. A arquitetura e os limites dessa
integração estão em [Arquitetura](../docs/architecture.md).
