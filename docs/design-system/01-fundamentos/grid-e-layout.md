# Grid e layout

## Estrutura padrão de uma tela de operação (shell)

```
┌──────────────────────────────────────────────────────────────────────┐
│ CABEÇALHO 62–64 px: logo · nome do app · menus · abas/passos         │
├───────────┬──────────────────────────────────────────────────────────┤
│ LATERAL   │ CONTEÚDO (cartões sobre cor.fundo.app, margem 24)        │
│ (opcional)│                                                          │
│ 280–340px │                                                          │
├───────────┴──────────────────────────────────────────────────────────┤
│ RODAPÉ DE STATUS 32 px: hora · máquina · conexões (bolinhas) · versão │
└──────────────────────────────────────────────────────────────────────┘
```
Detalhes: [04-padroes-de-tela/shell-operacional.md](../04-padroes-de-tela/shell-operacional.md).

## Colunas

| Contexto | Colunas | Calha (gap) | Margem |
|---|---|---|---|
| Desktop operação (≥ 1280) | 12 | 16 | 24 |
| Diálogo (DialogoDesign) | 6 colunas por seção | 16 | 24 |
| Web pública ≥ 1024 | 12 | 24 | 24–64 |
| Tablet 768–1023 | 8 | 16 | 24 |
| Celular < 768 | 4 | 16 | 16 |

Campos de formulário ocupam 1, 2, 3 ou 6 colunas da seção de 6 (`d.Campo(g, "Rótulo", controle, colunas)`).

## Larguras

- **Conteúdo de leitura** (site, textos): máx. 72 caracteres por linha (~720 px).
- **Diálogo**: 560 (simples), 760, 860/900 (com seções), 960 (padrão), 1060 (cadastro com lista). Altura acompanha o
  conteúdo (encolhe sozinha); se não couber na tela, o corpo rola e **cabeçalho e rodapé ficam fixos**.
- **Lateral**: 280–340 px; nomes longos cortam com "…" (nunca quebram o layout), dica mostra o nome inteiro.
- **Cartões lado a lado**: em proporção (ex.: passos 1–3 = 30% / 22% / 48%), nunca em pixels fixos.

## Comportamento quando falta espaço (ordem de prioridade)

1. Barras de botões **quebram de linha** (o rodapé do cartão cresce) — nunca escondem botão atrás de outro.
2. Colunas de tabela menos importantes **somem** (definidas por tela) e a tabela ganha **rolagem horizontal**.
3. Busca e campos auxiliares **encolhem** até um mínimo; subtítulos cortam com "…".
4. Elementos secundários vão para uma **segunda linha** (ex.: seletor de bateria abaixo das bandeiras).
5. **Nunca**: sobrepor, cortar texto de botão, esconder a ação principal ou exigir rolagem horizontal da janela inteira.

## Alinhamento

Tudo alinha à grade de 8 e à borda esquerda do conteúdo. Números à direita; texto à esquerda; títulos de coluna
acompanham o alinhamento do conteúdo (coluna com filtro: título centralizado e funil à direita).
