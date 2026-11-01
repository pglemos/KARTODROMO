> Relatório histórico. O estado atual está em [Revisão 2](AUDITORIA-2026-10-19-R3.md).

# Auditoria do aplicativo — 19/10/2026

## Resultado

Código local corrigido e verificações automatizadas aprovadas. **A entrega ainda não está pronta para produção.** A API pública configurada responde HTTP 404, parte das telas usa fixtures e existem alertas em dependências. Não foi publicado backend, app nas lojas ou alteração em equipamentos da operação.

Revisão orientada pelo [Impeccable](plugin://impeccable@openai-curated-remote), referências de auditoria nativa Android e padrões já presentes no aplicativo. A identidade OLED da versão recebida foi preservada.

## Correções

- Agenda não usa mais vagas ou preços fictícios enquanto carrega ou quando a API falha. Erro e nova tentativa agora são visíveis, com estado de carregamento e lista vazia.
- Datas disponíveis vêm dos horários consultados; removidos os dias fixos de 14–18/10/2026. Selecionar uma data filtra exclusivamente aquele dia.
- A ação de reservar e a data/hora do backend ficam visíveis; removido o botão interativo de 1×1 invisível dentro do cartão clicável.
- Home respeita a área segura superior; marca e atalhos de reserva/conta antes invisíveis agora aparecem. Removida a afirmação sem fonte “Pista aberta”.
- HUD calcula a rotação com a área efetivamente disponível, preservando o botão fechar; removidos dois controles sem ação. Carrinho utiliza superfícies OLED também na tela e no drawer.
- Carrinho preserva o nome real da pista em vez de substituí-lo por “Acelera Kart”. Remover item e fechar carrinho têm controles visíveis com área mínima de 48 dp. A instrução descreve toque, pois não existe gesto de swipe implementado.
- Sem callback de checkout, confirmar explica que nenhum pedido foi enviado; a tela do carrinho também não navega silenciosamente como se tivesse criado um pedido.
- Telas demonstrativas exibem aviso persistente. Agenda, autenticação, pedidos, resultados oficiais e GPS preservam seus fluxos próprios.
- Atualizados os cinco pacotes apontados pelo Expo Doctor dentro do SDK 57 e aplicadas correções compatíveis disponíveis pelo npm. Removida variável de tema não utilizada.
- Incluído projeto Android nos pacotes completos, excluídos caminhos locais do SDK, caches e dependências instaladas; manifesto regenerado com hashes atuais. Cópias anteriores preservadas em Downloads/APP KART/anteriores-<data-hora>.

## Verificação automatizada

| Verificação | Resultado |
| --- | --- |
| Jest mobile | 24 suítes, 347 testes aprovados |
| TypeScript | aprovado |
| ESLint Expo | aprovado sem avisos |
| Expo Doctor | 21/21 verificações |
| Exportação Android/Hermes | aprovada, bundle de aproximadamente 3,2 MB |
| Gradle assembleDebug ARM64 | aprovado |
| API mobile em Vitest | 6 arquivos, 35 testes aprovados |

Os testes do backend foram executados no worktree com dependências instaladas, após comparação byte a byte dos 10 arquivos do Worker e dos seis arquivos de teste contra o pacote entregue. Nenhuma diferença encontrada.

Os arquivos em `tests/e2e/` usam harnesses React com dados simulados. Sua aprovação **não comprova** compra real, gateway, cronometragem ao vivo ou navegação em aparelho. As novas regressões verificam ausência de vagas fictícias após falha, filtragem por data e controles visíveis do carrinho.

## Pendências de produção

- **P0 — API:** GET `https://reservas.kartodromodebetim.com.br/api/mobile/v1/agenda` retornou HTTP 404 com `{"erro":"Rota desconhecida."}`. O handler existe no código entregue; publicação, domínio, bindings e migrations precisam ser verificados no ambiente de destino. Não foram feitas mutações em produção.
- **P1 — Integrações esportivas:** ranking, notícias, carreira, conquistas, LiveTime e HUD consomem fixtures. O HUD não recebe deltas ao vivo, e atualizar LiveTime não consulta cronometragem. O aviso evita apresentar esses valores como oficiais; a integração real continua pendente.
- **P1 — Carrinho:** demonstração local sem criação de pedido ou checkout integrado. Reservas reais usam o formulário existente, acessado pela agenda quando o backend estiver disponível.
- **P1 — Dependências:** `npm audit` retorna 65 alertas (49 altos, 16 moderados); `--omit=dev` retorna 62 (46 altos, 16 moderados). Os totais incluem cadeias transitivas e ferramentas distribuídas com Expo, não 65 falhas independentes do app. As correções restantes sugeridas pelo npm incluem trocas incompatíveis de Expo, Router, React Native ou Jest. Não foi usado `--force`, nem realizado downgrade de SDK para esconder o relatório. Avaliar versões corrigidas e revalidar antes da distribuição.
- **P2 — Adaptatividade:** HUD ainda gira o conteúdo por transformação em vez de controlar orientação nativa, agora limitado à área disponível. Na fonte 1,3, delta do HUD usa reticências e o atalho horizontal de parceiros exige rolagem; isso continua como limitação visual. Tablets, acessibilidade TalkBack, texto ampliado em todas as telas e desempenho em hardware ainda precisam de QA específico.
- **P2 — Documentação visual:** `DESIGN.md` recebido descreve uma versão anterior clara/escura e navegação diferente. O código atual e a solicitação descrevem OLED. Não foi feita substituição de direção visual. O contexto Impeccable da raiz pertence ao site, não ao app; o sidecar do site também foi apontado como desatualizado, fora desta alteração.

## Evidência Android

Build de QA instalado como `br.com.kartodromobetim.app.codexqa` em Android 16, emulador ARM64 1080×2400, com fonte 1,3 e modo escuro. O pacote original foi preservado: instalar com o mesmo identificador foi recusado por diferença de assinatura. O identificador de QA foi aplicado por script Gradle temporário, sem alterar o código entregue. Capturas em `evidencias-auditoria-2026-10-19/`. A agenda mostrou o erro real e o botão de nova tentativa, sem vagas fictícias. Conferidas as cinco abas, HUD e carrinho; confirmadas Home/HUD/carrinho após a rodada de correções. Buffer de crashes vazio durante o smoke test. Fonte e modo noturno do emulador foram restaurados a 1,0 e não ao encerrar.

## Limites

Não foram testados iOS, dispositivo físico, assinatura de produção, pagamento, envio de e-mail real, publicação em lojas ou cronometragem operacional. Não há declaração de que “tudo funciona” baseada apenas nos testes.

Impeccable instalado: v4.3.1; v4.6.0 disponível para atualização em outra sessão. O contexto visual do site pode ser atualizado com `document`, separadamente.
