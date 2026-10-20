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

No pacote mobile isolado, os seis testes identificados com `[monorepo]` são ignorados porque conferem arquivos do site e da CI; todas as verificações do aplicativo continuam ativas. No pacote completo, os seis testes também são executados.

O app usa `https://reservas.kartodromodebetim.com.br` por padrão. Para homologação, defina `EXPO_PUBLIC_API_URL` no ambiente local. Não coloque tokens do Worker, chaves Asaas, credenciais de loja ou dados pessoais no cliente.

Os perfis EAS `development`, `preview`, `simulator` e `store-preview` usam a homologação `https://kartodromo-mobile-homolog.kartodromo.workers.dev`. O ambiente tem D1/R2 próprios e reservas fechadas. Ver [estado da distribuição](../docs/mobile/distribution-status.md).

## Compilação nativa local

`npm run android` e `npm run ios` geram os projetos nativos com Expo e compilam para um dispositivo ou emulador. As pastas `android/` e `ios/` são geradas e ficam fora do Git.

- Android: JDK 17, Android SDK/API 36 e NDK 27.1.12297006. Configure `JAVA_HOME` e `ANDROID_HOME` para essas instalações.
- iOS: Expo SDK 57 exige Xcode 26.4 ou superior, além de um runtime iOS disponível. Xcode 26.2 não atende esse requisito.
- Um APK local de QA pode ser compilado depois de `npx expo prebuild --platform android --no-install`, executando `NODE_ENV=production ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` dentro de `android/`. O template usa assinatura de desenvolvimento nesse build; ele não é um artefato de loja. Para assinatura de distribuição, use os perfis EAS abaixo.

## Builds EAS

- `development`: cliente de desenvolvimento interno.
- `preview`: instaladores diretos para QA em iOS/Android; Android gera APK.
- `simulator`: build iOS para simulador, sem exigir assinatura Apple; não instala em iPhone físico.
- `store-preview`: artefatos assinados para TestFlight e faixa interna do Google Play; Android gera AAB.
- `production`: build de loja; este perfil não é enviado automaticamente para nenhuma loja.

O projeto EAS está vinculado a `@synvolt/kartodromo-betim` em `app.json`. `EAS_PROJECT_ID` permite substituir esse vínculo por ambiente; em GitHub Actions, configure-a como variável e `EXPO_TOKEN` como secret. Os certificados Apple e Google devem ser administrados pelo EAS; não adicionar arquivos de assinatura ao repositório.

Com o ambiente Android local configurado e login EAS ativo, `npx eas-cli@24.13.0 build --platform android --profile store-preview --local --non-interactive --output /tmp/kartodromo-internal.aab` gera um AAB usando as credenciais administradas pelo EAS. O perfil incrementa o versionCode remoto. Isso comprova compilação e assinatura; a validação funcional nos dispositivos e do servidor continua necessária.

Para solicitar builds internos, execute manualmente o workflow **Mobile app**. Ele publica os links e IDs retornados pela EAS como artefato da execução. O workflow não executa `eas submit` nem publica em uma faixa aberta.

Depois da validação nos dispositivos e da confirmação das contas/credenciais, gere e envie os artefatos internos com `npx eas-cli@24.13.0 build --platform all --profile store-preview` e `npx eas-cli@24.13.0 submit --platform all --profile preview --latest`. A submissão Android fica como rascunho na faixa interna; a submissão iOS vai ao App Store Connect/TestFlight.

## Pré-requisitos de lançamento

- A política `/privacidade` é uma minuta até o responsável confirmar controlador, canal LGPD e retenção.
- O GPS permanece desabilitado enquanto a geometria medida da pista não for aprovada.
- Aplicar as migrations D1 e configurar tokens/provedor de e-mail apenas no ambiente correspondente; nunca usar o D1 local como banco remoto.
- Confirmar IDs de pacote nos consoles, contas de desenvolvedor, credenciais e dispositivos físicos antes de builds assinados ou upload interno.
# Verificação em 19/10/2026

Este pacote inclui uma prévia visual OLED. Ranking, notícias, carreira e telemetria usam dados demonstrativos, identificados no aplicativo; não representam a operação real. O carrinho demonstrativo não cria pedidos. Reservas reais passam pela agenda da API e pelo formulário de reservas existente.

Quando `/api/mobile/v1/agenda` não estiver implantada (404), a agenda consulta `/api/agenda` e oferece “Reservar no site”, abrindo a página oficial. Autenticação e checkout mobile ainda exigem backend compatível. Não há comprovação de pagamento real ou publicação nas lojas.

O projeto `android/` está incluído. Exige Android SDK, JDK e `ANDROID_HOME` configurados na máquina de destino; `android/local.properties` é local e não acompanha o ZIP. `debug.keystore` é a chave pública padrão de desenvolvimento, sem valor para distribuição: configure sua própria assinatura de produção, fora do código.

Resultados, correções, dependências pendentes e evidências: `AUDITORIA-2026-10-19-R3.md`.


Projeto iOS também incluído. No macOS com Xcode e plataforma iOS instalados: `cd ios && pod install`, depois `npm run ios` na pasta mobile. O simulador exige runtime instalado; esta versão foi compilada nativamente no EAS com Xcode 26.6 para simulador (arm64/x86_64), mas não executada no iOS nesta máquina. Consulte o relatório R3 para o ID do build e o artefato.
