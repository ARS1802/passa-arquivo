# Passa Arquivo

API para administrar arquivos e diretórios de uma única pasta local por HTTPS em
rede local. Tecnologias escolhidas: **TypeScript, Express e Zod**.

**Estado: etapa 2 concluída — estrutura e configuração.** Disponíveis: compilação TypeScript,
validação de configuração por CLI/ambiente e testes automatizados. O servidor HTTPS
e os endpoints continuam planejados.

## Funcionalidades previstas

Saúde autenticada; metadados, listagem e download; upload de um arquivo por requisição;
criação e exclusão de diretórios/arquivos; renomeação, movimentação, cópia e download
de diretórios em ZIP. Bearer token, HTTPS, CORS configurável e isolamento de caminhos
integram o escopo. Veja o [contrato](doc/endpoints.md).

## Requisitos e execução

Base verificada em Linux x86_64: Node.js **24.19.0**, npm **11.17.0**, TypeScript 7,
Express 5 e Zod 4. Dependências exatas estão no lock. Se já utiliza nvm, execute
`nvm use` para selecionar a versão de [.nvmrc](.nvmrc) no terminal atual.

```sh
npm ci
npm run check
npm run check:config -- --root /srv/passa-arquivo/shared \
  --state-dir /srv/passa-arquivo/state --staging-dir /srv/passa-arquivo/staging
```

`check` verifica tipos, compila e executa testes. `check:config` confere somente
sintaxe e relações entre opções, sem criar diretórios ou iniciar servidor. Os caminhos
acima são exemplos; nenhuma existência ou permissão é verificada por esse comando.
As [opções e regras completas](doc/configuration.md) detalham precedência e limites.
A instalação é uma preparação; não deve ser repetida a cada conferência.

O comando de inicialização HTTPS será entregue na etapa 8. Exemplo de uso
**planejado**, utilizável após essa entrega:

```sh
curl --cacert "$CLIENT_CA_CERT" \
  --header "Authorization: Bearer $CLIENT_TOKEN" \
  'https://localhost:8443/health'
```

`CLIENT_CA_CERT` é o caminho do certificado público confiável (ou CA emissora), e
`CLIENT_TOKEN` contém um token válido entregue pelo operador. São variáveis do
cliente deste exemplo. O certificado deverá incluir `localhost` no SAN.

## Documentação e limites

Consulte o [índice](doc/README.md), o [planejamento e estado](doc/progress.md), as
[verificações](doc/testing.md) e as [regras para agentes](AGENTS.md).
O escopo é rede local, processo único e permissões iguais para todos os tokens.
Links simbólicos são proibidos pelo contrato. Credenciais e temporários ficarão fora
da pasta compartilhada. A execução normal exigirá HTTPS, sem fallback HTTP.
Windows e macOS não têm suporte anunciado. A validação atual não comprova isolamento
do filesystem, validade de credenciais/certificados ou disponibilidade da futura API.
