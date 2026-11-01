# Código-fonte — Kartódromo Internacional de Betim

Base histórica: 08230b8a267a5f05bf4a535a703cad28d485549d; pacote inclui alterações locais posteriores, sem commit de release.
Branch: feature/kartodromo-mobile-app
Data do pacote: 19/10/2026

## Conteúdo
- mobile/: app completo React Native/Expo, telas, assets, configurações, testes e lockfile.
- workers/pre-cadastro/: API Cloudflare, autenticação, reservas, cupons, resultados e migrations D1.
- lib/, services/, migrations/: integrações e serviços de operação/reservas/cronometragem usados pelo backend.
- tests/: testes existentes do backend e integrações.
- docs/mobile/: documentação técnica, distribuição, design e evidências visuais.
- .github/workflows/mobile.yml: automação do app.

## Executar o aplicativo
Instale Node.js compatível com Expo SDK 57 e execute:

```sh
cd mobile
npm ci
npx expo start
```

Leia mobile/README.md para emuladores, compilação nativa e builds EAS.
O projeto nativo Android está incluído, com Gradle e wrapper. Configure Android SDK/JDK na máquina de destino. iOS continua usando geração nativa pelo Expo.

## Backend
Na raiz do pacote, execute npm ci. O Worker usa workers/pre-cadastro/wrangler.jsonc
(produção) ou wrangler.homolog.jsonc (homologação). Configure as credenciais Cloudflare,
D1/R2, Asaas e e-mail separadamente. Consulte os bindings desses arquivos e as interfaces
Env no código. Para desenvolvimento local:

```sh
npx wrangler dev --config workers/pre-cadastro/wrangler.homolog.jsonc
```

As migrations estão em workers/pre-cadastro/migrations/. A criação de recursos e aplicação
de migrations devem usar o ambiente correspondente. Não reutilize bancos de produção em QA.
Os serviços de operação também dependem da infraestrutura local do kartódromo.

## Estado e limites
Os perfis internos EAS apontam para homologação. GPS aguarda geometria medida/aprovada;
reservas, pagamentos e e-mail reais dependem das configurações do servidor.
Certificados Apple/Google, tokens, senhas e dados de runtime não estão neste pacote.
Não inclui node_modules, binários compilados, caches, caminhos locais do SDK ou histórico Git. Inclui o projeto nativo Android e a chave padrão pública de debug; configure assinatura própria para distribuição.
Este pacote contém o app e suas integrações; o site institucional completo e programas
Windows desktop separados não fazem parte desta entrega.

## Auditoria atual
Consulte mobile/AUDITORIA-2026-10-19.md. As telas esportivas ainda contêm dados demonstrativos identificados no app. A agenda pública retornou HTTP 404. Não tratar esta entrega como homologação de produção. MANIFESTO.json contém os hashes atuais de cada arquivo, excluindo o próprio manifesto.
