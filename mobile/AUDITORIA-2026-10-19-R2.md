> Histórico da revisão 2. Consulte `AUDITORIA-2026-10-19-R3.md` para o estado atual.

# Auditoria mobile — revisão 2 — 19/10/2026

## Resultado atual

A agenda voltou a consultar **horários reais** no Android. Quando a rota mobile retorna 404, o app consulta a agenda pública oficial e identifica o botão como **Reservar no site**. O botão abriu a página oficial de reservas no emulador. Nenhum pedido ou pagamento foi criado durante o teste.

Ainda não é uma homologação completa de produção: autenticação e reservas mobile dependem da implantação do backend; ranking, notícias, carreira e telemetria permanecem demonstrativos e identificados na interface.

Revisão com [Impeccable](plugin://impeccable@openai-curated-remote), [Test Android Apps](plugin://test-android-apps@openai-curated-remote) e [Build iOS Apps](plugin://build-ios-apps@openai-curated-remote).

## Correções adicionais

- Consulta compatível com a agenda pública oficial em `/api/agenda`, somente após 404 na rota mobile. Erros 403 não são contornados. A consulta real retornou 417 horários no momento da verificação; esse número varia com a operação.
- Agenda valida preços em centavos, IDs, datas, disponibilidade e duplicatas antes de exibir os dados. O limite por pedido é distinto da capacidade da bateria.
- Horários usam FlatList, preservando filtros por data sem renderizar toda a agenda de uma vez. Respostas antigas e consultas desmontadas não substituem o resultado atual.
- Marca original na agenda; removidos marca substituta, categoria de dias da semana e comprimento de traçado que estavam fixos sem fonte no retorno da API. Controles de quantidade e voltar têm área de 48 dp.
- Requisições têm limite de 15 segundos, incluindo leitura da resposta, e liberam o temporizador. Falhas orientam nova tentativa.
- Carrinho rejeita frações, números não finitos, valores negativos, totais fora da precisão inteira e quantidades superiores ao limite informado. Mudar de sessão limpa os itens e fecha o drawer. A renovação dos tokens também limpa o carrinho enquanto a API não fornecer um accountId estável.
- Atualização transitiva de UUID restrita ao gerador Xcode, preservando Expo SDK 57. Leitura, escrita e geração de IDs do projeto Xcode foram verificadas com a versão corrigida. O lockfile preserva os registros opcionais já existentes no checkout principal.
- Projeto nativo iOS e Podfile.lock gerados pelo Expo/CocoaPods. Os ZIPs incluem suas fontes, além do Android; não incluem Pods, builds, caminhos locais do SDK/Node ou credenciais de distribuição.

## Verificações desta rodada

| Verificação | Resultado |
| --- | --- |
| Jest mobile | **26 suítes, 370 testes aprovados** |
| TypeScript | aprovado |
| ESLint Expo | aprovado sem avisos |
| Expo Doctor | 21/21 |
| API mobile em Vitest | 6 arquivos, 35 testes aprovados |
| Exportação Hermes | iOS e Android aprovados |
| Projeto iOS | prebuild, CocoaPods e configuração nativa aprovados; compilação bloqueada pelo ambiente |
| Android | variante de QA nativa existente, código atual carregado pelo Metro, emulador Android 16 ARM64 |

Os testes do backend foram executados no worktree após comparação byte a byte dos dez arquivos do Worker e dos seis arquivos de teste com o pacote entregue. Não houve diferença. Os testes denominados e2e em `tests/e2e/` usam harnesses React; não representam pagamentos reais nem testes completos em dispositivos.

No Android, foram verificados horários reais, abertura do site oficial, filtro exclusivo de 22/10/2026 e validação local de login vazio, com fonte 1,3 e modo escuro. O buffer de crashes estava vazio. Fonte e modo noturno foram restaurados para 1,0 e desativado. O app original foi preservado; o pacote de QA é `br.com.kartodromobetim.app.codexqa`.

As capturas atuais estão em `evidencias-auditoria-2026-10-19-r2/`. As capturas e o relatório sem R2 pertencem à rodada anterior.

## Bloqueios e riscos restantes

- **Backend mobile:** produção responde 404 para `/api/mobile/v1/agenda`; homologação responde 403, informando que a reserva online não está aberta. O código do handler está incluído. A CLI Cloudflare não tem credencial disponível nesta sessão para inspecionar/publicar o ambiente. Não foi publicado código nem alterado o estado das reservas em produção ou homologação.
- **iOS nativo:** XcodeBuildMCP encontrou zero simuladores e `simctl` encontrou zero runtimes. A tentativa de build genérico também foi recusada pelo Xcode: `iOS 26.2 is not installed`. Havia aproximadamente 6,7 GB livres inicialmente, insuficientes para instalar o runtime e compilar. As dependências foram resolvidas, mas **não há prova de compilação nativa ou execução iOS desta versão**. Caches iOS criados nesta rodada foram removidos para recuperar espaço; fontes e lockfile foram preservados.
- **Segurança de dependências:** a auditoria mais recente retorna **57 alertas: 49 altos e 8 moderados**, ante 65 na primeira rodada. Os totais incluem propagação por dependências, não 58 falhas independentes. Permanecem avisos originados em braces, decode-uri-component, node-forge e sprintf-js. O último decode corrigido é ESM e não pode substituir diretamente a dependência CommonJS atual sem validar/migrar o Router; as demais versões estáveis consultadas ainda aparecem afetadas. Não foi usado audit fix --force, downgrade do Expo ou supressão dos avisos. O npm também informa incompatibilidade de peer transitivo do reconciliador de testes; a instalação e os 370 testes foram verificados sem trocar o React exigido pelo SDK.
- **Funcionalidades demonstrativas:** aviso visível não equivale à integração real de ranking, notícias, carreira, conquistas, LiveTime ou HUD. O carrinho demonstrativo não cria pedido e não implementa remoção por swipe. A reserva real disponível nesta versão é encaminhada ao site oficial.
- **Cobertura:** sem iPhone/Android físico, TalkBack completo, tablets, assinatura de distribuição, e-mail real, pagamento real ou cronometragem operacional. HUD ainda usa rotação visual; não há comprovação de orientação nativa iOS.

## Entrega

Pastas e os quatro ZIPs atualizados; versões anteriores preservadas em `Downloads/APP KART/anteriores-...`. O pacote completo contém manifesto SHA-256 por arquivo; `SHA256-2026-10-19.txt` identifica os ZIPs atuais. Fonte local com alterações ainda não publicadas em Git; não corresponde a um novo commit de release.
