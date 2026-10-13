# As 10 heurísticas de usabilidade (Nielsen) aplicadas ao sistema

Cada heurística: o que significa aqui, exemplo do sistema e **como verificar** numa tela (use na auditoria e no aceite).

## 1. Visibilidade do estado do sistema
O usuário sempre sabe o que está acontecendo.
- Exemplos: bolinhas de status no rodapé (PLACAR, DECODER, TV); "ao vivo" / "preparando" na árvore de baterias;
  "Enviando…" no e-mail do resultado; relógio da prova parado na vermelha.
- Verificar: toda operação que leva mais de 1 s mostra carregando; toda conexão tem indicador; estado da bateria visível.

## 2. Correspondência com o mundo real
Palavras e ordem do mundo do usuário.
- Exemplos: "bateria", "tomada de tempo", "quadriculada", "troca de kart", "redutor"; ordem dos passos 1–3 → 4–5 → ao vivo.
- Verificar: nenhum termo técnico de programação na tela ("null", "ID", "status 500"); datas dd/mm/aaaa; moeda R$ 0,00.

## 3. Controle e liberdade (desfazer)
Saída de emergência para ações por engano.
- Exemplos: Esc fecha qualquer diálogo; estorno no caixa; restaurar passagem excluída; reabrir/retomar equalização;
  excluir observação pergunta antes.
- Verificar: todo diálogo fecha com Esc e ✕ sem efeito colateral; ação destrutiva tem confirmação **ou** desfazer.

## 4. Consistência e padrões
O mesmo jeito em todo lugar.
- Exemplos: botão principal verde à direita do rodapé; Cancelar sempre ao lado; mesma tabela, mesmo campo.
- Verificar: só componentes do [03-componentes](../03-componentes/); `npm run lint:design` limpo; rodapé no padrão.

## 5. Prevenção de erros
Melhor impedir que corrigir.
- Exemplos: fim de bateria é manual (nunca automático); confirmação com o nome do item ("Excluir o kart 07?");
  botão desabilitado com motivo ("Finalize a prova antes de enviar"); validação de horário antes de remontar.
- Verificar: deslize (clique errado) não destrói dado; campos numéricos não aceitam texto; seleção não muda sozinha
  com um modal aberto.

## 6. Reconhecer em vez de lembrar
Opções visíveis, não decoradas.
- Exemplos: rótulo sempre visível acima do campo (nunca só placeholder); busca com sugestões; última escolha lembrada.
- Verificar: nenhum campo sem rótulo; nenhum código a decorar; atalhos aparecem na dica (tooltip) do botão.

## 7. Flexibilidade e eficiência
Atalhos para quem já sabe.
- Exemplos: F1–F11 na cronometragem; Enter confirma; Insert/Delete nas passagens; duplo clique abre o registro.
- Verificar: ação frequente tem atalho; Tab percorre na ordem visual; Enter no último campo salva.

## 8. Estética e minimalismo
Só o necessário na tela; o resto em menu/aba/segundo plano.
- Exemplos: menu "Mais ▾" para ações raras; colunas pouco usadas somem em tela estreita.
- Verificar: no máximo 1 ação principal por área; texto de ajuda curto; nada decorativo competindo com dado.

## 9. Reconhecer, diagnosticar e se recuperar de erros
Mensagem diz o que houve e o que fazer.
- Exemplos: "A lista de pilotos mudou enquanto o registro estava aberto. Feche e abra de novo."; campo inválido com
  borda vermelha + texto embaixo.
- Verificar: nenhuma mensagem genérica ("Erro"); erro aparece junto do campo; caminho de volta sem perder o digitado.

## 10. Ajuda e documentação
Ajuda no lugar certo.
- Exemplos: notas "Como funciona" nos cartões; dicas nos botões de ícone; `docs/operacao/` para a equipe.
- Verificar: botão só de ícone tem dica; tela nova complexa tem nota de ajuda; manual da operação atualizado.
