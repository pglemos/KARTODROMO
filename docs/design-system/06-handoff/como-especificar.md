# Como especificar uma tela (handoff)

Nenhuma tela nova ou refeita entra no código sem especificação no [modelo](_modelo-especificacao-tela.md). A
especificação é o contrato entre quem desenha, quem programa (pessoa, Claude ou Codex) e quem aprova.

## O que toda especificação precisa ter
1. **Objetivo e quem usa** (cronometrista, recepcionista, gerente, cliente no totem, piloto no site).
2. **Telas em ordem** — diagrama `mermaid` do fluxo, com os desvios.
3. **Layout** — referência ao desenho aprovado (canvas de design: `NomeDaTela.dc.html`) e ao padrão de tela usado.
4. **Tabela de interações** — cada elemento clicável/digitável:

   | Elemento | Gatilho | Resposta da interface | Efeito de negócio | Destino |
   |---|---|---|---|---|
   | botão "Salvar" | clique / Enter | "Salvando…", depois toast | grava cliente | fecha o diálogo; lista seleciona o novo |

   Destino é sempre um destes: **permanece** · **redireciona para X** · **abre modal X** · **fecha e volta para X**.
5. **Validações** — campo, regra, momento (digitando / ao sair / ao salvar / servidor), mensagem exata.
6. **Estados** — carregando, vazio, erro, sem permissão, off-line, somente leitura ([padrão](../04-padroes-de-tela/estados-vazio-erro-carregando.md)).
7. **Caminhos alternativos** — cancelar no meio, voltar, falha de rede, dado mudou por outro usuário.
8. **Regra de interface × regra de negócio** — em colunas separadas. Interface: como aparece e reage. Negócio: o que o
   sistema decide (mora no servidor; a tela só reflete).
9. **Ordem de Tab** e atalhos.
10. **Responsividade** — o que muda em 1280×720 e no modo degradado.
11. **Critérios de aceite** — frases verificáveis ("Com 2 karts sem piloto, Iniciar fica desabilitado e a dica diz quais").
12. **Tokens e componentes usados** — só os do design system; se faltar algo, abrir proposta.

## Ordem de trabalho
Especificação → aprovação do dono → implementação → [aceite de tela](../08-governanca/aceite-de-tela.md) → changelog.

## Exemplos
- [Recepção — checkout](telas/recepcao-checkout.md)
- [Cronometragem — ao vivo](telas/crono-ao-vivo.md)
- [Totem — identificação](telas/totem-identificacao.md)
