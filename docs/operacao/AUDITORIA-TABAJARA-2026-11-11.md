# Auditoria de tempos — Tabajara, 11/11/2026

Fonte: diário bruto do decoder no ORBITS (`data/timing/passagens/2026-11-11.jsonl`) + sessões
`2026-11-11-ce398285` (Tabajara I) e `2026-11-11-df6c3026` (Tabajara II).

## Reclamação do Gedeon (Tabajara II, kart 125, transponder 5201004)

MyChron: 10 voltas (21:46, melhor 1:06.77) + 12 voltas (21:56, melhor 1:06.30, volta 10).
Sistema: 18 voltas, melhor **1:06.459** (4º lugar).

Passagens brutas do decoder × sistema: **19 de 19 contadas, nenhuma descartada, nenhuma perdida.**

| Hora | Volta | | Hora | Volta |
|---|---|---|---|---|
| 21:47:27 | largada | | 21:59:14 | 1:19.142 |
| 21:48:36 | 1:08.416 | | 22:00:21 | 1:06.686 |
| 21:49:43 | 1:07.532 | | 22:01:28 | 1:06.738 |
| 21:50:51 | 1:07.429 | | 22:02:34 | 1:06.636 |
| 21:52:00 | 1:09.585 | | 22:03:41 | 1:06.867 |
| 21:53:07 | 1:06.689 | | 22:04:48 | 1:06.571 |
| 21:54:14 | 1:06.831 | | 22:05:54 | 1:06.545 |
| 21:55:22 | 1:07.802 | | 22:07:01 | **1:06.459** |
| 21:56:48 | 1:26.844 | | 22:08:07 | 1:06.478 (bandeirada) |
| 21:57:55 | 1:06.888 | | 22:09:37 | volta de desaceleração, fora da sessão |

Conclusão:
- Não houve parada de contagem: nenhuma volta com ~2:13 (o que indicaria passagem perdida).
- A volta lenta 1:26.8 às 21:56 é exatamente onde o MyChron abriu a 2ª sessão (parou/aliviou).
- 22 voltas no MyChron = voltas antes da 1ª passagem no laço + volta de saída + volta de entrada.
  O sistema conta só de laço a laço dentro da sessão: 18.
- 1:06.30 vs 1:06.459: o MyChron sem beacon marca volta por GPS (linha virtual em outro ponto,
  erro típico de 0,1–0,2 s por volta). A mesma volta no laço magnético deu 1:06.46/1:06.48.
  Cronometragem oficial = transponder, que bate com o Orbits no milissegundo.
- Com 1:06.30 ele seria 2º (Bernardo 1:06.003, Lucca 1:06.315, Thiago 1:06.319).

## Auditoria geral

Tabajara I (15 pilotos) e Tabajara II (13): todas as passagens do decoder foram contadas
(fora as de depois da bandeirada). Trocas de kart registradas corretamente (José Augusto 102→131,
Lucca 128→130, Eduardo 137→105).

Pontos para conferir com o fiscal/vídeo (não afetam melhor volta):
- Bernardo (II, k117): volta de 2:20.65 às 21:52:15 — tamanho de 2 voltas; pode ser passagem
  perdida ou parada. Se perdida, ele teria 18 voltas, não 17.
- João Alves (I, k125): volta de 2:08.58 às 21:21:46 — parada? coincide com a troca do José Augusto.
- Eduardo (II): voltas longas são da troca de kart (137→105).
