# Conteúdo, textos e mensagens

## Voz

Português do Brasil, direto, de igual para igual, sem jargão técnico. Fala a língua da pista ("bateria", "piloto",
"kart", "volta", "box", "largada"). No público: entusiasmo com sobriedade. Na operação: curto e exato.

## Regras de escrita

1. **Rótulo de botão = verbo + objeto**: "Salvar cliente", "Iniciar bateria", "Estornar pagamento". Nunca "OK",
   "Sim/Não" soltos, "Clique aqui", "Submeter".
2. **Frase de caixa** (só a primeira letra maiúscula): "Nova bateria", não "Nova Bateria". MAIÚSCULAS só nos títulos
   Anton do público e em siglas (CPF, PIX → "Pix" é marca, escreve-se "Pix").
3. Números: `R$ 1.234,56` · `12/10/2026` · `17:40` · tempo de volta `1:02.470` (ponto separa milésimos, padrão de
   cronometragem) · `3 voltas`, `1 volta`.
4. Sem pontos de exclamação na operação. Sem "Por favor" em excesso. Sem culpar o usuário.
5. Nomes iguais para as mesmas coisas em todo o sistema (glossário abaixo).

## Mensagem de erro (modelo)

**O que aconteceu + por quê (se ajudar) + o que fazer.**

| ❌ | ✅ |
|---|---|
| "Erro 500" | "Não foi possível salvar o cliente. O servidor não respondeu. Tente de novo em alguns segundos." |
| "Campo inválido" | "CPF incompleto: faltam 2 números." |
| "Falha na operação" | "A bateria não foi iniciada porque ainda há 2 karts sem piloto. Atribua os karts ou remova as vagas." |
| "Exception: …" | (detalhe técnico vai para o `erros.log`, nunca para a tela) |

Erro de campo: embaixo do campo, cor `perigo` + ícone, aparece ao sair do campo (ou ao salvar), some quando corrigido.

## Confirmação destrutiva (modelo)

Título: **"Excluir {o quê}?"** · Corpo: nome do item + consequência ("As 12 voltas desta bateria serão apagadas. Isso
não pode ser desfeito.") · Botões: **"Excluir {o quê}"** (perigo) e "Cancelar" (secundário, com foco inicial).
Ver [03-componentes/confirmacao-destrutiva.md](../03-componentes/confirmacao-destrutiva.md).

## Estado vazio (modelo)

Ícone 48 + título curto + uma frase que explica + ação: "Nenhuma bateria hoje. Crie a primeira para começar.
[Nova bateria]". Em busca sem resultado: "Nenhum cliente com 'Jo'. Confira a grafia ou [Cadastrar novo cliente]."

## Sucesso

Toast curto, no passado: "Cliente salvo.", "Pagamento de R$ 80,00 recebido.", "E-mail enviado a 8 pilotos." —
com "Desfazer" quando possível.

## Glossário (use sempre este termo)

| Use | Não use |
|---|---|
| bateria | sessão, corrida (exceto em campeonato), heat |
| piloto | corredor, cliente (na pista) |
| cliente | usuário, pessoa (no cadastro) |
| kart | carro, veículo |
| volta | lap |
| largada / relargada | start / restart |
| bandeira quadriculada | fim de corrida automático |
| cronometrista | operador da crono |
| recepção / caixa | balcão, PDV |
| estornar | cancelar pagamento, devolver |
| traçado | pista, layout (quando é a configuração do circuito) |
| redutor | restritor, limitador |
| equalização | balanceamento |
