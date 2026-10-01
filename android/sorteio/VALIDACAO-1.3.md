# Sorteio de Karts 1.3 — validação

Data: 27/09/2026.

## Entrega

- APK: `C:\KartodromoApps\instaladores\SorteioKarts-1.3.apk`
- `versionCode`: 4; `versionName`: 1.3.
- SHA-256 do APK: `5DAB83D2133BA9887864E037F1FB12B42714DEFBFA671F708D37FE1C02DE5EC6`.
- Certificado igual ao APK 1.1: SHA-256 `4df24aefb0986944f888ea6a9d194e910e9d9ec3bce2aa654f89f2dc98b6b16b`; apksigner confirmou os esquemas v2 e v3 nos dois arquivos.
- A pasta externa `C:\KARTODROMO\android-assinatura` foi preservada sem alteração.

## Mudanças

O fluxo recebeu uma identidade visual de controle de pista: logo do Kartódromo, tema grafite/esmeralda, contraste alto, hierarquia tipográfica, cartões compactos e navegação por etapas. A tela inicial, a preparação e o resultado se adaptam ao tablet e mantêm atualização, compartilhamento e gravação. A revisão Impeccable nativa acrescentou contraste AA nos destaques, estados semânticos para TalkBack, confirmação antes de descartar uma escalação incompleta, retry de carregamento, voltar visível no resultado e respeito às animações do sistema.

O fiscal pode selecionar `Fiscal escolhe` na preparação, escolher um kart para cada piloto e editar o peso conferido antes de confirmar. O mesmo kart não pode ser usado por dois pilotos. A escalação mostra o vínculo piloto/kart, o peso e o lastro calculado.

As metas são 90 kg para kart Light e 100 kg para kart Super. O cálculo usa peças de 5 kg e 2,5 kg, arredondando para cima em incrementos de 2,5 kg para que o peso final nunca fique abaixo da meta. O resultado e o POST de gravação levam `modo: fiscal`, `lastroKg`, `pecas5Kg` e `pecas2_5Kg`.

## Verificação executada

- `./gradlew.bat testDebugUnitTest --console=plain`: BUILD SUCCESSFUL; 10 testes, 0 falhas, 0 erros.
- `./gradlew.bat assembleRelease lintDebug --console=plain`: BUILD SUCCESSFUL; lint sem erros e 10 avisos informativos.
- O APK final foi instalado por cima no `emulator-5554`; `apksigner verify --verbose --print-certs` confirmou os esquemas v2/v3 e o mesmo certificado da versão 1.1.
- `npx vitest run tests/timing-sorteio.test.ts --reporter=dot`: 5 testes passaram; inclui o rótulo `fiscal escolhe`.
- A suíte web completa foi executada: 320 de 321 testes passaram. O único teste falhou em `lib/public-navigation.test.ts` porque arquivos antigos de `public/design` estão fora de sincronia com `design-source/`; essa diferença já existia fora do módulo do aplicativo e não foi alterada nesta entrega.
- Android 34 em emulador `emulator-5554`, com instalação de atualização sobre o pacote existente, sem desinstalar.
- Fluxo fiscal completo com 6 pilotos e 6 karts: seleção individual, edição de 77 kg para 80 kg, cálculo de 2 peças de 5 kg e final de 90 kg, conferência e gravação.
- A gravação de teste confirmou seis atribuições distintas, peças de lastro e `modo: "fiscal"` em `C:\KARTODROMO\sorteio-premium-qa\gravacao.json`.
- `adb logcat -b crash -d` ficou vazio ao concluir o fluxo.
- Auditoria Impeccable: avaliação dual (25/40 heurísticas; 15/20 auditoria nativa) e detector web executado uma vez sobre `android/sorteio/app/src/main` com saída `[]` por não suportar Compose. Os achados nativos foram corrigidos e validados novamente.
- Evidências visuais finais: `C:\KARTODROMO\sorteio-premium-qa\home-impeccable-final.png`, `preparar-impeccable-final.png`, `fiscal-impeccable-final.png`, `fiscal-impeccable-assigned-final.png` e `resultado-impeccable-final.png`.

Os POSTs de teste usaram exclusivamente o servidor HTTP de simulação local na porta 4150, com dados `TESTE CODEX`. Não houve gravação de sorteios em produção.

## Limites

A validação foi feita em emulador, não no tablet físico. O servidor local simula as respostas da API e não substitui a homologação da integração completa com a operação.

## Build local

Usar o JDK em `C:\AndroidDev\jdk-17.0.20.1+1`, SDK em `C:\AndroidDev\sdk` e diretório temporário curto `C:\AndroidDev\tmp`. Durante o build, configurar `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:/AndroidDev/tmp -Djdk.net.usePlainSocketImpl=true`, `TEMP` e `TMP` para essa pasta.
