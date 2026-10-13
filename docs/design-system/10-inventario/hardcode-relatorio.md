<!-- AUTO-GERADO por `npm run lint:design:relatorio` — não edite. -->
# Relatório de hardcode visual

Cor, fonte ou tamanho escritos direto no código em vez de token. **Total: 1660 ocorrências em 109 arquivos.**
A meta de cada fase de migração é baixar estes números (ver 07-arquitetura/proibicao-de-hardcode.md).

## Por aplicativo

| Aplicativo | Ocorrências |
|---|---|
| Site/admin · app/ | 520 |
| Páginas da cronometragem (timing-ui) | 370 |
| Site/admin · src/ | 241 |
| Desktop · Cronometragem | 196 |
| Desktop · Recepcao | 146 |
| Site/admin · lib/ | 76 |
| Site/admin · components/ | 45 |
| Desktop · Comum | 27 |
| Site/admin · styles/ | 19 |
| Tablet do sorteio (Android) | 17 |
| Desktop · Autoatendimento | 3 |

## Por regra

| Regra | Ocorrências | Como corrigir |
|---|---|---|
| `css-hex` | 638 | use var(--kib-cor-…) |
| `cs-cor-literal` | 297 | use Tokens.Claro.Cor… / Tokens.Escuro.Cor… |
| `css-rgb-hsl` | 218 | use var(--kib-cor-…) |
| `tw-paleta-crua` | 202 | use primary/ink ou var(--kib-…) |
| `tw-arbitrario` | 194 | use classes ligadas aos tokens |
| `cs-cor-nomeada` | 39 | use um token de cor (Color.Transparent é permitido) |
| `cs-fonte` | 35 | use Tokens.Fonte(Tokens.Claro.FonteTamanho…) |
| `css-font-family` | 19 | use var(--kib-fonte-familia-…) |
| `kt-cor` | 9 | use Tokens.Escuro.Cor… (pacote …sorteio.design) |
| `xml-cor` | 8 | use @color/kib_… |
| `cs-cor-html` | 1 | use um token de cor |

## 25 arquivos com mais ocorrências

| Arquivo | Total | Detalhe | Congelado |
|---|---|---|---|
| `app/podio-final-tb50/podio-final.css` | 184 | css-hex 72 · css-rgb-hsl 111 · css-font-family 1 | sim |
| `services/timing-ui/resultado.html` | 137 | css-hex 130 · css-rgb-hsl 5 · css-font-family 2 |  |
| `app/HomeDashboard.tsx` | 96 | tw-arbitrario 7 · tw-paleta-crua 89 |  |
| `services/timing-ui/tv.html` | 96 | css-hex 60 · css-rgb-hsl 35 · css-font-family 1 | sim |
| `app/designer-telao/designer.css` | 70 | css-hex 65 · css-rgb-hsl 1 · css-font-family 4 | sim |
| `app/TelaoProgramacao.tsx` | 68 | tw-arbitrario 5 · tw-paleta-crua 63 |  |
| `desktop/src/Kartodromo.Cronometragem/FormCrono.Design.cs` | 53 | cs-cor-literal 52 · cs-cor-nomeada 1 |  |
| `desktop/src/Kartodromo.Cronometragem/FormCrono.cs` | 49 | cs-cor-literal 41 · cs-cor-nomeada 8 |  |
| `desktop/src/Kartodromo.Recepcao/KitVisual.cs` | 45 | cs-cor-literal 43 · cs-cor-nomeada 1 · cs-fonte 1 |  |
| `services/timing-ui/equalizacao.html` | 45 | css-hex 44 · css-rgb-hsl 1 |  |
| `services/timing-ui/tb50.html` | 40 | css-hex 36 · css-rgb-hsl 3 · css-font-family 1 | sim |
| `lib/timing/email-resultado.ts` | 38 | css-hex 37 · css-font-family 1 |  |
| `services/timing-ui/tv-classica.html` | 37 | css-hex 35 · css-font-family 2 | sim |
| `src/index.css` | 37 | css-hex 10 · css-rgb-hsl 27 |  |
| `app/designer-telao/DesignerTelaoClient.tsx` | 33 | css-hex 33 | sim |
| `components/telao/telao.css` | 29 | css-hex 25 · css-rgb-hsl 4 | sim |
| `desktop/src/Kartodromo.Cronometragem/FormTV.cs` | 29 | cs-cor-literal 12 · cs-cor-nomeada 8 · cs-fonte 9 | sim |
| `app/podio-live-tb50/live-podium.css` | 28 | css-hex 7 · css-rgb-hsl 20 · css-font-family 1 | sim |
| `desktop/src/Kartodromo.Recepcao/Cadastros.cs` | 27 | cs-cor-literal 17 · cs-cor-nomeada 6 · cs-fonte 4 |  |
| `desktop/src/Kartodromo.Recepcao/Caixa.cs` | 24 | cs-cor-literal 16 · cs-cor-nomeada 3 · cs-fonte 5 |  |
| `src/components/Services.tsx` | 19 | tw-paleta-crua 19 |  |
| `src/admin/modules/dashboard/DashboardPage.tsx` | 18 | tw-arbitrario 18 |  |
| `src/components/Championships.tsx` | 18 | tw-arbitrario 4 · tw-paleta-crua 14 |  |
| `app/placar-telao-tb50/route.ts` | 17 | css-hex 11 · css-rgb-hsl 4 · css-font-family 2 | sim |
| `lib/ops/relatorios.ts` | 17 | css-hex 15 · css-rgb-hsl 2 |  |
