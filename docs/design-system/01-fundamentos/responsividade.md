# Responsividade

## Resoluções obrigatórias

### Apps nativos (Cronometragem, Recepção, Totem)

| Resolução | Situação | Exigência |
|---|---|---|
| 1920×1080 | PCs da recepção e cronometragem | layout completo |
| 1536×864 | notebook 1920 a 125% | layout completo |
| 1440×900 | — | layout completo |
| 1366×768 | notebooks comuns | layout completo |
| **1280×720** | **mínimo suportado** | **nada cortado, nada sobreposto** |
| 1366×768 a 125% (= 1093×614 lógicos) | modo degradado | rola; nada cortado/sobreposto; ação principal sempre visível |

Escala do Windows 100 / 125 / 150%. Os apps são **DpiUnawareGdiScaled** (o Windows estica o bitmap; o layout é feito em
pixels lógicos), então "1920 a 125%" se comporta como 1536×864.

Como testar: `Kartodromo.Cronometragem.exe --autoteste <pasta>` com `KARTODROMO_TESTE=telas` e
`KARTODROMO_AUTOTESTE_TAMANHO=1280x720` (repetir para cada resolução); Recepção com `--teste-telas`. As fotos saem fora
da tela, sem atrapalhar o operador. Ver [08-governanca/aceite-de-tela.md](../08-governanca/aceite-de-tela.md).

### Web (site público, reservas, admin, timing-ui)

| Token | Largura | Alvo |
|---|---|---|
| `tela.celular` | 360 | celular pequeno — mínimo |
| `tela.celular-g` | 390 | celular comum |
| `tela.tablet` | 768 | tablet retrato |
| `tela.toque-limite` | 1024 | abaixo disso, alvo de toque ≥ 44×44 |
| `tela.notebook` | 1280 | notebook |
| `tela.notebook-g` | 1366 | — |
| `tela.desktop` | 1440 | desktop |
| `tela.desktop-g` | 1536 | — |
| `tela.full-hd` | 1920 | monitor grande |

Abordagem **mobile-first** (`min-width`). Sem rolagem horizontal da página em nenhuma largura (tabelas largas rolam
dentro do próprio cartão). Verificação com Playwright em 3 tamanhos no mínimo (390, 768, 1440) depois de publicar.

### Dispositivos de toque

| Dispositivo | Tela | Alvo mínimo |
|---|---|---|
| Totem (autoatendimento) | 1920×1080, retrato/paisagem conforme o PC, teclado USB | 64 px; **sem teclado virtual** |
| Tablet do sorteio (Android) | ~1280×800 | 48 dp |
| Telão TB50 | fixo | congelado |

## O que muda por faixa

| Elemento | ≥ 1280 | 1024–1279 | 768–1023 | < 768 |
|---|---|---|---|---|
| Sidebar | fixa aberta | recolhível (só ícones) | gaveta sobre o conteúdo | gaveta |
| Tabela | todas as colunas | some coluna opcional | rolagem horizontal no cartão | vira lista de cartões |
| Barra de botões | linha única | quebra linha | quebra linha | ação principal fixa embaixo |
| Diálogo | largura do token | 90% da tela | 100% − 32 | tela cheia |
| Margem lateral | 24 | 24 | 24 | 16 |

## Regras

1. **Nunca** cortar texto de botão, rótulo ou valor. Se não cabe: quebrar linha, encolher área secundária ou rolar.
2. Ação principal sempre visível sem rolar (fica no rodapé fixo).
3. Proporções, não pixels fixos, para dividir a tela (ex.: 30% / 22% / 48%).
4. Ancoragem certa no WinForms: `Dock`/`Anchor` + `TableLayoutPanel`/`FlowLayoutPanel` com `WrapContents`; nada de
   `Location` absoluto calculado para 1920.
5. Altura dos diálogos acompanha o conteúdo e é limitada à área útil da tela (corpo rola).
