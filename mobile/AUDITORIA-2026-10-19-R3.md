# Auditoria mobile — revisão 3 — 19/10/2026

## Resultado

Corrigida a incompatibilidade do renderizador de testes com o React do Expo SDK 57. Corrigida também a execução dos testes no ZIP exclusivo mobile: verificações que exigem arquivos do site/CI ficam identificadas como `[monorepo]`, sem impedir a validação do app isolado.

A agenda pública oficial continua respondendo com horários reais. O backend mobile ainda precisa de implantação/configuração; ranking, notícias, carreira, conquistas, LiveTime, HUD e carrinho continuam demonstrativos e sinalizados na interface. Este pacote não equivale a um lançamento completo em produção.

Revisão com Impeccable, Test Android Apps e Build iOS Apps; as correções visuais e a execução Android estão documentadas na revisão 2. Esta revisão modifica dependências, testes, empacotamento e documentação, sem alterar a interface.

## Correções desta revisão

- `test-renderer` fixado na linha compatível `~1.2.0`: versão instalada 1.2.0, reconciliador 0.33.0 e React 19.2.3. Elimina o peer incompatível que vinha do renderer 1.3.1, sem trocar o React exigido pelo SDK.
- Seis verificações de integração com o site/CI executam no pacote completo. No pacote mobile isolado, aparecem explicitamente como ignoradas. As verificações de configuração, assets existentes, contraste e funcionalidades locais permanecem ativas. Antes da correção, a reprodução isolada falhava em seis testes.
- `.easignore` exclui dependências, caches, evidências, relatórios, arquivos locais e credenciais privadas do upload de build, preservando os projetos nativos Android/iOS.
- Fontes sincronizadas nas três pastas indicadas, com comparação contra o ZIP anterior antes de sobrescrever e backup das versões anteriores.

## Verificações

| Verificação | Resultado |
| --- | --- |
| Jest no pacote completo | 26 suítes, **373 testes aprovados**, zero ignorados |
| Jest com fontes mobile isoladas | 26 suítes, **367 aprovados**, seis verificações `[monorepo]` ignoradas |
| TypeScript / ESLint | aprovados; lint sem avisos |
| Expo Doctor | **21/21** |
| Backend Vitest | seis arquivos, **35 testes aprovados** |
| Exportação Hermes | iOS e Android aprovados |
| Dependências do renderer | `npm ls` sem erro de peer |
| API pública de agenda | HTTP 200; 417 horários no momento da consulta |
| API mobile produção / homologação | HTTP 404 / HTTP 403 |

Os testes isolados reutilizaram a instalação de dependências por link local, sem arquivos externos do site/CI. A instalação limpa `npm ci --include=dev` também foi executada pelo EAS na compilação remota. Os arquivos mobile do Worker e os testes do backend usados na validação foram comparados com o pacote entregue, sem diferenças.

Os testes React denominados e2e usam harnesses; não comprovam pagamentos reais. A validação Android em emulador permanece a da revisão 2: agenda real, abertura do site oficial, filtro de data, login vazio e fonte ampliada, com configurações restauradas. Não houve alteração visual nesta revisão.

## iOS

**Compilação nativa aprovada no EAS**, com Xcode 26.6. Build `77b1f5a7-63a8-44dc-a258-8124cf504c00`, concluído em 19/10/2026 às 17:31:47 (Brasília). [Registro do build](https://expo.dev/accounts/synvolt/projects/kartodromo-betim/builds/77b1f5a7-63a8-44dc-a258-8124cf504c00).

Artefato baixado e inspecionado: bundle `br.com.kartodromobetim.app`, plataforma `iPhoneSimulator`, executável Mach-O universal com arm64 e x86_64 e `main.jsbundle` presente. Arquivo `Downloads/APP KART/Kartodromo-Betim-iOS-Simulador-R3.tar.gz`, 29.117.889 bytes. O SHA-256 está no arquivo de checksums e na evidência `ios-build.json`.

O build usa o perfil `simulator`, com backend de homologação e sem assinatura de distribuição. Esse artefato é destinado ao simulador, não instala em iPhone físico e não representa submissão à App Store/TestFlight. Os ajustes finais após o envio ao EAS atingem testes e documentação, sem mudar código executável, dependências ou fontes nativas.

A execução local permanece bloqueada: Xcode 26.2 é anterior ao mínimo 26.4 exigido pelo SDK 57; não há runtime ou simulador instalado e o espaço livre está limitado. Não foi executado o aplicativo em iOS nesta máquina.

## Pendências e riscos

- **Backend:** produção não oferece `/api/mobile/v1/agenda`; a homologação mantém reservas fechadas. A agenda de produção funciona por `/api/agenda` e direciona a reserva ao site oficial. A credencial OAuth local Cloudflare expirou. Não houve publicação do Worker nem alteração de reservas/bancos. A configuração de produção contém um ID D1 provisório e precisa ser completada antes de qualquer implantação.
- **Dependências:** auditoria atual com **57 alertas: 49 altos e oito moderados**, propagados de quatro causas: braces, decode-uri-component, node-forge e sprintf-js. As sugestões automáticas incluem migrações incompatíveis; o decode corrigido mudou para ESM. Não foi aplicado `audit fix --force`, downgrade do Expo ou supressão dos alertas.
- **Integrações:** autenticação, checkout e resultados mobile dependem do backend compatível. As telas demonstrativas não foram convertidas em integração real. Carrinho não cria pedido e não tem remoção por swipe. HUD permanece com rotação visual.
- **Cobertura:** sem iPhone/Android físico, execução iOS, TalkBack completo, tablets, assinatura de loja, envio real de e-mail, pagamento real ou cronometragem operacional. Não foram alterados o sistema Windows, telão ou servidor real de cronometragem.

## Entrega

Relatório atual: `AUDITORIA-2026-10-19-R3.md`. Evidências sanitizadas: `evidencias-auditoria-2026-10-19-r3/`. Relatórios anteriores são históricos.

Os quatro ZIPs mantêm os nomes informados pelo usuário. O pacote completo inclui `MANIFESTO.json` com SHA-256 dos arquivos e `Downloads/APP KART/SHA256-2026-10-19.txt` identifica os ZIPs atuais. Fontes nativas incluídas; dependências, caches, builds e credenciais privadas excluídos. As alterações locais desta auditoria não foram publicadas em Git.
