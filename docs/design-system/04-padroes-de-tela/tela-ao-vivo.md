# Tela ao vivo (cronometragem durante a bateria)

A tela mais crítica do sistema: o cronometrista olha de relance, com pressa, por horas.

```
┌ cabeçalho: (1 Bateria)─(2 Pilotos)─(3 Corrida)   [F1 Verde][F2 Amarela][F3 Vermelha][F7 Branca][F4 Quadriculada][Finalizar · F5] ┐
├───────────────┬──────────────────────────────────────────────────────┬──────────────────┤
│ baterias      │ CRONÔMETRO 12:34   Volta 8/12   ● Verde               │ PASSAGENS        │
│ do dia        │ ┌ Pos │ Nº │ Piloto       │ Voltas │ Última │ Melhor │ Dif ┐ │ (tempo real)     │
│ (árvore)      │ │ 1   │ 12 │ João Silva   │   8    │ 55.214 │ 54.980 │  —  │ │ 12  55.214       │
│               │ │ 2   │ 07 │ Maria Souza  │   8    │ 55.870 │ 55.102 │ +0.6│ │ 07  55.870       │
│               │ └─────────────────────────────────────────────────┘ │ …                │
├───────────────┴──────────────────────────────────────────────────────┴──────────────────┤
│ status: ORBITS ● · servidor ● · telão ● · 17:42 · v1.0.46                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Regras de interface
1. **Grade ao vivo** (`LiveGrid`): linha 32, números em fonte numérica à direita, posição em destaque. A melhor volta
   da prova aparece em roxo (`cor.dominio.melhor-volta`: claro `#7A2FC2`, escuro `#C084FC`) **e** com o marcador ■ na
   célula (`LiveGrid.Destaque`) — o mesmo símbolo da legenda "■ melhor volta da prova". Linha não "pula": troca de posição sem piscar a tela inteira.
2. Bandeiras: botões grandes com a cor da bandeira **e o nome** e a tecla (F1…F7). Bandeira atual sempre visível no topo.
3. **Fim da bateria é manual**: só o cronometrista finaliza (F5 / "Finalizar"), mesmo com o tempo esgotado ou a
   quadriculada dada. Nada encerra sozinho.
4. Ações sobre um piloto (penalidade, ADV, troca de kart, desclassificar) pelo clique direito na linha **e** por botão
   na barra — com confirmação quando destrutivas.
5. Atualização contínua sem indicador de carregando; perda de conexão → banner vermelho + bolinha, dados congelados
   marcados com "atualizado às 17:40:12".
6. Telão (F11 / Shift+F8–F10) é **outra** tela, congelada ([telao.md](telao.md)).

## Regras de negócio (vivem no servidor de cronometragem, não na tela)
Contagem de voltas, ordem de classificação, penalidades em tempo/posição, bandeira preta = último (DC), relargada,
troca de kart levando as voltas do piloto.
