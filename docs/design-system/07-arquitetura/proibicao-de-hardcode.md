# Proibição de hardcode (cor e fonte fora dos tokens)

Toda cor, família de fonte e tamanho visual vem dos tokens. O verificador `npm run lint:design`
(`scripts/design-tokens/lint-hardcode.mjs`) roda no CI e **reprova** hardcode novo.

## O que ele procura
| Regra | Exemplo reprovado | Use |
|---|---|---|
| `cs-cor-literal` | `Color.FromArgb(11, 122, 83)` | `Tokens.Claro.CorAcaoPrincipal` |
| `cs-cor-nomeada` | `Color.Red`, `Color.WhiteSmoke` | token semântico |
| `cs-cor-html` | `ColorTranslator.FromHtml("#0B7A53")` | token |
| `cs-fonte` | `new Font("Segoe UI", 9.5F)` | `Tokens.Fonte(13)` |
| `css-hex` | `color: #c4281c` | `var(--kib-cor-estado-perigo-texto)` |
| `css-rgb-hsl` | `rgba(0,0,0,.3)` | `var(--kib-cor-sobreposicao)` |
| `css-font-family` | `font-family: Arial` | `var(--kib-fonte-familia-interface)` |
| `tw-arbitrario` | `bg-[#030504]` | `bg-[var(--kib-cor-fundo-app)]` |
| `tw-paleta-crua` | `text-red-600` | variável `--kib-*` |
| `kt-cor` | `Color(0xFF087F5B)` | `Tokens.Escuro.CorAcaoPrincipal` |
| `xml-cor` | `<color>#087F5B</color>` | `@color/kib_escuro_*` |

Fora do escopo: arquivos gerados, `Tokens.cs`, `design-source/`, `public/design/`, testes.
Grupo **congelado** (telão: `FormTV`, `tv.html`, `tb50.html`, `app/telao`…) é contado mas nunca reprova.

## Catraca (baseline)
`tokens/hardcode-baseline.json` guarda quantos hardcodes cada arquivo tem hoje (cerca de 3.400 no total — número exato no [relatório](../10-inventario/hardcode-relatorio.md)). O CI falha se:
- um arquivo **aumentar** a contagem; ou
- um arquivo **novo** tiver hardcode.

Diminuir é sempre permitido. Depois de migrar uma tela, baixe a catraca:
```bash
npm run lint:design:baseline
```
Relatório por arquivo e regra (vai para `10-inventario/hardcode-relatorio.md`):
```bash
npm run lint:design:relatorio
```

## Exceção justificada
Quando não há como usar token (e-mail HTML, desenho GDI+ de bandeira oficial), marque a linha:
```csharp
var fundoEmail = "#0B7A53"; // design-lint-ignore: e-mail não suporta var()
```
O motivo é obrigatório e passa na revisão ([checklist de PR](../08-governanca/checklist-pr.md)).
