# Como propor uma mudança no design system

## Quando
- Precisa de uma cor, tamanho ou componente que não existe.
- Um token reprova contraste ou não serve num caso real.
- Uma regra deste guia atrapalha a operação.

## Passos
1. **Confira se já existe** (busca em `02-tokens/referencia.md` e `03-componentes/`). Variante de algo existente é melhor
   que componente novo.
2. **Escreva a proposta** (no PR ou em `docs/design-system/08-governanca/propostas/AAAA-MM-DD-assunto.md`):
   problema (com foto), telas afetadas, solução, tokens novos/alterados, impacto no contraste, alternativas.
3. **Aprovação do dono** para tudo que muda o visual de tela em uso (sempre para totem, telão e cores de marca).
4. **Implemente na ordem**: `tokens/kib.tokens.json` → `npm run tokens` → documentação do componente → código.
5. **Aceite** ([aceite-de-tela](aceite-de-tela.md)) e **changelog** ([changelog](changelog.md)) com versão
   ([versionamento](../02-tokens/versionamento.md)).

## Quem decide
| Assunto | Decide |
|---|---|
| Marca, cores principais, totem, telão | dono do kartódromo |
| Token/componente novo sem efeito visual em tela existente | revisão do PR |
| Exceção `design-lint-ignore` | revisão do PR (motivo obrigatório) |

## Decisões (registradas)
| Decisão | Opções | Situação |
|---|---|---|
| Borda de campo no tema claro | `#8E8E93` (passa 3:1) × manter `#DBDBDB` como exceção | **decidido 10/10: `#8E8E93`** (WCAG 1.4.11; o contraste virou regra que reprova o build) |
| Fonte Oswald (`--font-race`) | legitimar como numérica do público × remover | **decidido 10/10: legitimada** como fonte numérica/esportiva do público (em uso em /reservas e /historia) |
| Tema escuro opcional no admin web | sim × não | **decidido 10/10: sim, como já existe** — claro por padrão, botão sol/lua liga o escuro (`data-tema`, tokens do escuro) |
| Raio do chip no escuro | 3 → 4 | **decidido 10/10: 4** (meio passo da grade de 8) |
| Tablet do sorteio para neon | fase 7 | **decidido 09/10: neon** (Sorteio 1.5) |
| Cor da melhor volta (`cor.dominio.melhor-volta`) | claro `#7A2FC2`, escuro `#C084FC` (7:1 sobre o fundo escuro) + marcador ■ | **decidido** 08/10/2026 |
