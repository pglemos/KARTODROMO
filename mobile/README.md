# App Kartódromo de Betim

App cliente iOS/Android em Expo SDK 57, React Native, TypeScript e Expo Router. As rotas ficam em `src/app/`; APIs móveis e sessão são separadas do sistema Windows de operação.

## Desenvolvimento

```bash
npm ci
npm start
npm test -- --runInBand
npm run typecheck
npm run lint -- --no-cache
npm run doctor
npm run export
```

O app usa `https://reservas.kartodromodebetim.com.br` por padrão. Para homologação, defina `EXPO_PUBLIC_API_URL` no ambiente local. Não coloque tokens do Worker, chaves Asaas, credenciais de loja ou dados pessoais no cliente.

## Builds EAS

- `development`: cliente de desenvolvimento interno.
- `preview`: instaladores diretos para QA em iOS/Android; Android gera APK.
- `store-preview`: artefatos assinados para TestFlight e faixa interna do Google Play; Android gera AAB.
- `production`: build de loja; este perfil não é enviado automaticamente para nenhuma loja.

O projeto EAS exige a variável local `EAS_PROJECT_ID`. Em GitHub Actions, configure-a como variável e `EXPO_TOKEN` como secret. Os certificados Apple e Google devem ser administrados pelo EAS; não adicionar arquivos de assinatura ao repositório.

Para solicitar builds internos, execute manualmente o workflow **Mobile app**. Ele publica os links e IDs retornados pela EAS como artefato da execução. O workflow não executa `eas submit` nem publica em uma faixa aberta.

Depois da validação nos dispositivos e da confirmação das contas/credenciais, gere e envie os artefatos internos com `npx eas-cli@24.13.0 build --platform all --profile store-preview` e `npx eas-cli@24.13.0 submit --platform all --profile preview --latest`. A submissão Android fica como rascunho na faixa interna; a submissão iOS vai ao App Store Connect/TestFlight.

## Pré-requisitos de lançamento

- A política `/privacidade` é uma minuta até o responsável confirmar controlador, canal LGPD e retenção.
- O GPS permanece desabilitado enquanto a geometria medida da pista não for aprovada.
- Aplicar as migrations D1 e configurar tokens/provedor de e-mail apenas no ambiente correspondente; nunca usar o D1 local como banco remoto.
- Confirmar IDs de pacote nos consoles, contas de desenvolvedor, credenciais e dispositivos físicos antes de builds assinados ou upload interno.
