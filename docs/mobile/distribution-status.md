# Distribuição — estado em 13/10/2026

## Expo

Projeto: [@synvolt/kartodromo-betim](https://expo.dev/accounts/synvolt/projects/kartodromo-betim).

| Artefato | Build | Estado observado |
| --- | --- | --- |
| iOS simulador | `44823571-155a-4071-9b39-1e3f0c308335` | Concluído; não executado localmente nem em iPhone. |
| Android APK interno | `f6f59eb9-a987-4a56-ae72-362e62de6686` | Concluído; artefato assinado disponível no EAS. |
| Android AAB de loja | EAS local, versionCode 3 | Compilado, assinado e aceito no Google Play; rascunho interno. |

Os estados são um registro do momento; consultar o projeto Expo para acompanhar os builds. Credenciais Android são administradas pelo EAS.

APK interno: [download EAS](https://expo.dev/artifacts/eas/d_uiHpUjqYUftg4B-QwESE3kjKcm0CqznrUgAE6Q8I0.apk). Cópia local ignorada pelo Git: `mobile/dist/kartodromo-preview-signed.apk`, SHA-256 `975659a28fbb4bb2b3eaddabf94b2e68257234ff323feba931c6bd7502a7a151`. `apksigner verify` aprovou a assinatura; SHA-256 do certificado `0b415bcb6e72e5e9a7ba71276e94a37e769ab5da9b91bc76e83357424f693ffc`.

## Google Play

Cadastro criado e confirmado em tela:

- Nome: **Kartódromo de Betim**.
- Conta: **SynVolt**, pessoal, ID `5092095990324707477`.
- App ID do console: `4974467837476645031`.
- Pacote: `br.com.kartodromobetim.app`, disponibilidade confirmada no console.
- Idioma: português do Brasil (`pt-BR`); app gratuito.
- [Painel do app](https://play.google.com/console/u/0/developers/5092095990324707477/app/4974467837476645031/app-dashboard).
- Faixa interna ainda inativa. AAB **3 (1.0.0)** enviado e aceito no rascunho; nenhum lançamento distribuído neste registro.
- Lista **Kartódromo de Betim — responsável** criada com um testador (`synvollt@gmail.com`) e vinculada à faixa interna; console confirmou **1 de 3 tarefas concluídas**.
- Rascunho **1.0.0 — avaliação interna** salvo, com limitações de reservas/pagamento/resultados e GPS descritas nas notas.
- AAB local em `mobile/dist/kartodromo-internal-v3.aab` (ignorado pelo Git), SHA-256 `6de96c1e56fe94d4f44fdd693e0e3db3629c8b02939b4ea29e6794783b4e1f9e`.
- `jarsigner -verify`: assinatura verificada. Certificado de upload autoassinado, como esperado para Android; o console aceitou o artefato.
- Verificação ELF: **48 bibliotecas de 64 bits**, todos os segmentos LOAD alinhados a pelo menos **16.384 bytes**; sem falhas na checagem de páginas de 16 KB.
- Console confirmou SDK de destino **36**, API mínima **24** e **4 ABIs**.
- Build AAB em nuvem `0a732784-0e68-4cd5-a51d-17c6451f57aa` cancelado após conclusão local, para evitar duplicar o artefato anterior.
- Console exige teste fechado com pelo menos **12 testadores durante 14 dias** antes da solicitação de acesso à produção desta conta.

## Apple

Conta `synvollt@gmail.com`: autenticação e 2FA concluídos diretamente pelo responsável. Portal mostrou **Pedro Guilherme (Pendente)**; aviso: **“O processamento da compra pode levar até 48 horas.”**. O EAS confirmou ausência de equipe associada. Nenhum certificado de distribuição, IPA assinado ou envio ao TestFlight foi concluído.

Atualização às 19h de 13/10: e-mail autenticado da Apple informou problema no pagamento do pedido da assinatura. O responsável deve resolver com a administradora do cartão e contatar o suporte Apple para nova tentativa ou alteração do pagamento. A Apple informa cancelamento se não conseguir processar em 7 dias. Não foi feita outra compra nem enviado dado de cartão.

## Homologação Cloudflare

- Worker separado: [kartodromo-mobile-homolog](https://kartodromo-mobile-homolog.kartodromo.workers.dev/api/mobile/v1/results).
- Configuração: `workers/pre-cadastro/wrangler.homolog.jsonc`; sem rotas nos domínios de produção.
- D1 exclusivo `kartodromo-mobile-homolog`, quatro migrations aplicadas remotamente; R2 exclusivo com o mesmo nome.
- Cinco secrets novos gerados e enviados diretamente ao Worker: lookup, criptografia, administração, publicação e sincronização. Valores não gravados no repositório. Configurar/rotacionar os tokens de integração quando o servidor homologado estiver acessível.
- `RESERVAS_ATIVAS=0`; Asaas sandbox, sem chave de pagamentos. Cadastro por e-mail depende de Resend/remetente verificado.
- HTTP verificado: resultados públicos `200 []`; histórico e reservas sem sessão `401`; agenda `403` com reservas fechadas.
- Perfis EAS de avaliação usam esta URL; `production` mantém o destino de produção.
- Correções posteriores ao AAB3/APK anterior: logout visível, isolamento de lista/detalhes/Pix/histórico entre contas, bloqueio de navegação de reserva atrasada e serialização das operações de sessão/SecureStore. Suíte móvel: 38/38; lint e tipos aprovados.
- Os artefatos antigos da tabela antecedem estas correções e não devem ser distribuídos como candidato atual.

## Condições para liberar distribuição

Ver [QA e pendências](qa-2026-10-13.md). Persistem homologação das APIs, reserva/pagamento completo, revisão das dependências móveis, política LGPD confirmada, linha GPS medida e QA em dispositivos físicos. Preparar cadastro e artefatos não comprova essas condições.
