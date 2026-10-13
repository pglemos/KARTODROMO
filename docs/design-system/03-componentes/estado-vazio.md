# Estado vazio

**Status:** canônico · **Tema:** ambos

## Para que serve
Mostrar que **não há nada ainda**, explicar por quê e oferecer o próximo passo. Nunca uma área em branco.

## Anatomia
```
            [ícone 48, cor.texto.terciario]
          Nenhuma bateria hoje                ← subtitulo 15 semibold
   Crie a primeira bateria para começar.      ← corpo 13, cor.texto.secundario, máx. 2 linhas
              [ + Nova bateria ]               ← botão primário (ou secundário se já há primário na tela)
```
Centralizado na área do conteúdo (cartão/tabela), não na janela.

## Tipos
| Tipo | Título | Ação |
|---|---|---|
| Primeiro uso | "Nenhum cliente cadastrado" | "Cadastrar cliente" |
| Busca/filtro sem resultado | "Nenhum resultado para 'jo'" | "Limpar filtros" / "Cadastrar novo" |
| Dia sem movimento | "Nenhuma venda hoje" | — (só a frase) |
| Sem permissão | "Você não tem acesso a esta área" | "Falar com o gerente" (texto) |
| Concluído | "Tudo em dia" (ícone ✓) | — |

## Regras
- Diga o que acontece quando houver dados ("As voltas aparecem aqui assim que os karts passarem pelo sensor").
- Cabeçalho da tabela continua visível.
- Não confundir com **carregando** nem com **erro** ([padrão](../04-padroes-de-tela/estados-vazio-erro-carregando.md)).

## Implementação
WinForms: **`EstadoVazio`** pronto em `Kartodromo.Comum/Design/EstadoVazio.cs` (`new EstadoVazio("Nenhuma bateria hoje", "Crie a primeira…", "Nova bateria", NovaBateria)`) — as telas que hoje escrevem um `Label` migram nas fases 2–3. Web: componente `EstadoVazio`;
timing-ui `.empty`, `.report-empty`, `.vazio`.
