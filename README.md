# Passa Arquivo

O passa-arquivo é um sistema para compartilhar arquivos diretamente entre
dispositivos na rede local. Esta branch contém sua API central, que cuidará
das conexões, da identidade dos dispositivos e das operações de arquivos.

O projeto usa **TypeScript, Express e Zod** e será nativo em Linux Mint, Ubuntu
e Windows. O pareamento exigirá descoberta ativada nos dois dispositivos e
confirmação de um código. Depois, os certificados salvos permitirão reconhecer
os peers por mTLS, mesmo que seus IPs mudem.

A API ainda não recebe requisições. A base atual permite conferir configuração
e executar testes em Linux; ainda não implementa P2P nem compatibilidade com
Windows. Veja a [arquitetura](doc/architecture.md) e o [fluxo de conexão](doc/connection.md).

## Preparar a base atual em Linux

Use Node.js **24.19.0**, indicado em [.nvmrc](.nvmrc), e npm **11.17.0**.
Se você já usa nvm, execute `nvm use` na pasta do projeto para selecionar o Node.js.

```sh
npm ci
npm run check
```

`npm ci` instala as versões das dependências registradas no projeto.
`npm run check` verifica os tipos, compila o código TypeScript e executa os testes.

## Conferir a configuração

Depois da compilação, você pode conferir as opções que serão usadas pelo servidor:

```sh
npm run check:config -- --root /srv/passa-arquivo/shared \
  --state-dir /srv/passa-arquivo/state --staging-dir /srv/passa-arquivo/staging
```

Esse comando confere os valores informados e se as opções são compatíveis entre
si. Os caminhos acima são exemplos: o comando não cria pastas nem confere se elas
existem ou podem ser acessadas. Também não lê certificados ou tokens e não inicia
um servidor.

Veja as [opções de configuração](doc/configuration.md) para entender cada valor.

## Documentação

O [guia de documentação](doc/README.md) reúne as opções de configuração, as rotas
previstas e as explicações sobre o código e os testes.
