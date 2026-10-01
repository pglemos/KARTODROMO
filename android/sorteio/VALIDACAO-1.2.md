# Sorteio de Karts 1.2 — validação

Data: 27/09/2026.

## Entrega

- APK: C:\KartodromoApps\instaladores\SorteioKarts-1.2.apk
- versionCode: 3; versionName: 1.2.
- SHA-256: 4F5B73F71485CA20E989488AAED82CCB2F7F05EEA99C2D33BB289F8132C3808B.
- Certificado idêntico ao APK 1.1 anexado, verificado com apksigner (v2/v3).
- Pasta externa de assinatura preservada, sem alteração.

## Mudanças

Tema grafite/esmeralda, contraste e hierarquia tipográfica consistentes, cartões de bateria reorganizados, etapas do fluxo, novo palco com grid e fila. Em telas menores a home usa abas, a preparação permite rolagem e as ações se ajustam ao espaço. O resultado mantém ordenação, compartilhamento e gravação.

Testar conexão usa uma API temporária e não altera o servidor salvo. Endereços inválidos retornam ErroServidor em vez de MalformedURLException não tratada. O teste novo foi observado falhando antes da correção e passando depois.

## Verificação executada

- Gradle testDebugUnitTest, assembleRelease e lintDebug: BUILD SUCCESSFUL.
- 6 testes automatizados: 0 falhas / 0 erros. Sorteador inclui 300 sementes no teste de atribuições e 200 no teste de recusas.
- Lint: 0 erros, 9 avisos (dependências mais novas, convenção de Modifier, HTTP necessário à rede local, backup, qualificador de recurso, cor não usada e ícone monocromático ausente). Não foi feita atualização de dependências.
- Android 34 em emulador, 1280×800 dp e 800×600 dp.
- Instalação de atualização sobre o APK original 1.1, sem desinstalar, preservando preferências.
- Todos de uma vez: animação, pular animação, resultado e gravação; 6 pilotos / 6 karts distintos.
- Um a um: sorteio, aceitação automática, resultado e gravação; 6 pilotos / 6 karts distintos.
- Recusa de kart: retorna à proposta vazia e permite novo sorteio.
- Grade compacta: karts acessíveis e aviso com zero karts selecionados.
- Fila do palco compacto acessível por rolagem.
- Endereço inválido mostra aviso; cancelar preserva servidor anterior.
- Logcat de crashes vazio ao concluir os testes.
- Revisão de código independente concluída; dois problemas de layout identificados e corrigidos.

Os POSTs de teste usaram exclusivamente um servidor HTTP de simulação local, porta 4150, com dados TESTE CODEX. Não houve gravação de sorteios em produção. Evidências e servidor de teste estão em C:\KARTODROMO\sorteio-premium-qa.

## Limites

Validação realizada em emulador, não em tablet físico. O servidor de teste simula as respostas da API; não substitui homologação da integração completa com a operação. Não é uma garantia de ausência de todos os defeitos.

## Build local

Usar o JDK em C:\AndroidDev\jdk-17.0.20.1+1, SDK em C:\AndroidDev\sdk e diretório temporário curto C:\AndroidDev\tmp. O caminho temporário padrão causou falha de socket local do Java; JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:/AndroidDev/tmp -Djdk.net.usePlainSocketImpl=true resolveu o build. Configurar TEMP e TMP para a mesma pasta somente no processo de compilação.
