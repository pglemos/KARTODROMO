# Movimento, animações e transições

| Token | Valor | Uso |
|---|---|---|
| `movimento.duracao.rapido` | 120 ms | hover, foco, troca de cor, pressionar |
| `movimento.duracao.padrao` | 200 ms | abrir menu, trocar aba, aparecer toast |
| `movimento.duracao.lento` | 320 ms | abrir modal, painel lateral |
| `movimento.curva.padrao` | `cubic-bezier(0.2, 0, 0, 1)` | entrada (desacelera ao chegar) |
| `movimento.curva.saida` | `cubic-bezier(0.4, 0, 1, 1)` | saída (acelera ao sair) |

## Para que serve animação aqui

Só para **explicar uma mudança**: de onde veio o modal, que a linha subiu de posição, que o toast vai sumir. Nunca
para enfeitar. Telas de operação são usadas por horas — animação que atrasa o operador é defeito.

## Catálogo

| Evento | Animação | Duração |
|---|---|---|
| Hover/pressionar botão | cor de fundo muda | rápido |
| Foco por teclado | anel aparece (sem animar tamanho) | imediato |
| Abrir modal | véu esmaece + cartão sobe 8 px e aparece | lento, curva padrão |
| Fechar modal | inverso | padrão, curva saída |
| Abrir menu/lista | aparece de cima com 4 px | padrão |
| Toast | entra da borda, fica 4–6 s, sai | padrão |
| Troca de posição na corrida (web) | linha desliza para a nova posição | padrão |
| Volta mais rápida | célula pisca roxo/verde uma vez | lento |
| Carregando | barra/indicador contínuo; esqueleto em listas | — |

## Microinterações (catálogo fechado)

Microinteração = resposta pequena e imediata a **uma** ação. Use só as daqui; outra nova passa por proposta.

| Gatilho | Resposta | Tokens | Onde já existe |
|---|---|---|---|
| Ponteiro sobre botão/link | fundo escurece 4–8%; no web, sobe 1–2 px (`translateY(-1px)`) | rápido | admin (`.admin-icon-button`, `.admin-submit`) |
| Pressionar | tom pressionado, sem deslocamento | rápido | todos os botões |
| Foco por teclado | anel 2 px `cor.borda.foco`, aparece sem animar | — | todos |
| Item ativo da barra lateral | fundo `acao/11%` + ponto que brilha à direita | padrão | admin, Recepção |
| Ponteiro sobre item de menu | desliza 2 px para a direita | rápido | admin (`.admin-nav-link`) |
| Salvar com sucesso | botão mostra "Salvo ✓" 1,5 s ou toast verde | padrão | apps (`Toast`) |
| Copiar | dica "Copiado" 1,5 s no lugar do botão | rápido | diálogos (Ctrl+C) |
| Campo inválido ao sair | borda `cor.estado.perigo.solido` + texto abaixo; **não treme** | rápido | formulários |
| Interruptor | bolinha desliza, trilho muda de cor | rápido | admin, apps |
| Carregando > 300 ms | rótulo "Salvando…" + indicador; antes disso, nada | — | `Botao.Carregando` |
| Kart passou (ao vivo, web) | varredura de luz na linha, 1 vez | lento | `/tv` |
| Subiu/desceu posição | linha desliza + seta ▲/▼ por 3 s | padrão | `/tv` |
| Melhor volta | célula com roxo + marcador ■ (nunca só a cor) | lento | Cronometragem, `/tv` |

## Efeitos visuais permitidos

| Efeito | Onde | Regra |
|---|---|---|
| Desfoque de fundo (`backdrop-filter: blur`) | barra superior do admin, véu de modal, cabeçalho da TV | até 12 px; nunca sobre texto que precisa ler |
| Brilho neon (`box-shadow` com a cor de ação) | **só no escuro/público**: pontos de status, barra de tempo, foco do site | difuso, ≤ 14 px, uma cor |
| Confete | vencedor no fim da corrida (`/tv`) | só ali, 1 vez por ciclo |
| Esqueleto (bloco pulsando) | listas e cartões carregando na web | pulso lento, sem brilho deslizante |

Nos apps nativos (WinForms) não há animação de layout: as microinterações viram troca imediata de cor/estado.

## Regras

1. **Reduzir movimento**: na web, `@media (prefers-reduced-motion: reduce)` corta deslocamentos e mantém só troca de
   opacidade/cor. Nos apps nativos, animações já são mínimas (WinForms não anima layout).
2. Nada pisca mais de 3 vezes por segundo (risco de crise fotossensível). Bandeira na pista **não pisca** na interface.
3. Nunca bloqueie o clique esperando animação terminar.
4. Telão: fora deste catálogo (congelado).
