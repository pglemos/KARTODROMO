# Acessibilidade

Meta: **WCAG 2.2 nível AA** em toda tela nova ou migrada. O build dos tokens já reprova pares de cor que não passam
(`$extensions.kib.contraste` em `tokens/kib.tokens.json`).

## 1. Contraste

| O quê | Mínimo |
|---|---|
| Texto normal (< 18,66 px negrito / < 24 px regular) | **4,5:1** |
| Texto grande | 3:1 |
| Borda de campo, ícone que transmite informação, anel de foco, gráfico | **3:1** contra o vizinho |
| Texto desabilitado, logotipo, decoração | sem exigência |

Pares verificados automaticamente: ver tabela de contraste em [02-tokens/referencia.md](../02-tokens/referencia.md).
Pendência conhecida: borda de campo do tema claro (1,38:1) — ver [cor.md](cor.md).

Valores do código **antigo** que reprovam (corrigidos nos tokens novos, valem na migração): laranja `#B26A00` (4,24),
azul `#1E6FE8` sobre `#F5F5F7` (4,29), texto terciário `#8E8E93` (3,26).

## 2. Nunca só a cor

Toda informação dada por cor tem um segundo sinal: texto, ícone, forma ou posição.
Exemplos do sistema: status do piloto (cor + texto "Pit"), volta mais rápida (cor + negrito + ícone), conexão (bolinha
+ "On-line"), campo inválido (borda + mensagem), bandeira (cor + nome "Amarela").

## 3. Teclado

- **Tudo** que se clica também se alcança com Tab e se aciona com Enter/Espaço.
- Ordem de Tab = ordem visual (esquerda→direita, cima→baixo). Definir `TabIndex` explícito em diálogos.
- **Enter** confirma a ação principal do diálogo (`AcceptButton`); **Esc** cancela/fecha (`CancelButton`) — sem perda
  silenciosa: se houver alteração não salva, pergunta.
- Foco inicial no primeiro campo editável (ou na busca, em listas).
- Foco **visível**: anel `foco.largura` 2 px, `foco.deslocamento` 2 px, `cor.borda.foco`. Nunca `outline: none` sem
  substituto. No WinForms, controles desenhados à mão desenham o anel em `Focused`.
- Atalhos de função da Cronometragem (F1–F11) documentados na própria tela (dica e menu Ajuda).
- Modal prende o foco dentro dele e devolve o foco a quem o abriu ao fechar.

## 4. Leitor de tela e nomes

- Web: HTML semântico (`button`, `label for`, `table`/`th scope`), `aria-label` em botão só-ícone, `aria-live="polite"`
  em toast e placar, `role="alert"` em erro de formulário.
- WinForms: `AccessibleName` em botão só-ícone e em controles desenhados (`Painel`, `Botao` próprio);
  `AccessibleRole` correto; rótulo `Label` antes do campo na ordem do controle.
- Imagens informativas com texto alternativo; decorativas com `alt=""`.

## 5. Alvo de toque e ponteiro

| Contexto | Mínimo |
|---|---|
| Desktop com mouse | 24×24 (WCAG 2.5.8); padrão do sistema 32–40 |
| Web/tablet abaixo de 1024 px | **44×44** (`tela.toque-limite`) — token `componente.controle.alvo-toque` 48 |
| Tablet do sorteio | 48 dp |
| Totem | **64 px** (`componente.totem.alvo-toque`) |

Distância de pelo menos 8 px entre alvos vizinhos de toque.

## 6. Texto e zoom

- Web: funciona a 200% de zoom sem perder conteúdo; tamanhos em `rem`; nada de `user-scalable=no`.
- Desktop: funciona a 100/125/150% de escala do Windows (apps são DpiUnawareGdiScaled — ver
  [responsividade.md](responsividade.md)).
- Nunca texto em imagem (exceto logo).

## 7. Movimento e tempo

`prefers-reduced-motion` respeitado; nada pisca > 3×/s; nenhuma tela some sozinha com informação que o usuário ainda
precisa ler (toasts de erro ficam até serem fechados). Sessões com tempo (totem) avisam antes de reiniciar.

## Roteiro rápido de verificação (para cada tela)

1. Navegar a tela inteira só com teclado; Enter e Esc fazem o esperado.
2. Foco sempre visível.
3. Ver a tela em escala de cinza: nada se perde.
4. Conferir contraste dos pares novos (`npm run tokens:check` cobre os tokens).
5. Zoom 200% (web) / escala 150% (desktop): nada cortado.
6. Botões só-ícone têm nome acessível.

## Exceção: listas longas ao vivo (desktop)

Grade com centenas/milhares de linhas que mudam a cada segundo (passagens da corrida) usa
`LiveGrid.AcessibilidadeResumida = true`: para o Windows ela é **uma tabela com nome e resumo** ("Passagens: 2590
linhas: …"), sem expor célula por célula. Motivo medido em 09/10/2026: um leitor de acessibilidade que percorria a
árvore inteira deixava a Cronometragem com um núcleo em 100% (75 s para responder). As demais grades seguem expondo as
células normalmente.
