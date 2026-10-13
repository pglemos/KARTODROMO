# Identidade visual

> Substitui `docs/brandbook-kartodromo.md` (de 06/2026, paleta clara com CTA vermelho, que nunca foi aplicada).

## Essência

**Motorsport técnico e confiável.** Para o público, a energia da pista à noite (escuro, verde neon, tipografia de
corrida). Para quem opera, a clareza de uma ferramenta profissional (claro, calmo, denso, sem enfeite).
As duas faces são **a mesma marca**: o mesmo verde, os mesmos nomes de token, as mesmas regras de forma e espaço.

## Logo

- Arquivo oficial: `public/brand/kib-logo.png` (1536 × 427, PNG transparente). Cópia dos apps:
  `desktop/src/Kartodromo.Comum/Recursos/logo.png`. Na cronometragem: `services/timing-ui/kib-logo.png`.
- **Nunca** redesenhar, recolorir, inclinar, distorcer, aplicar degradê ou usar como marca d'água sem controle de contraste.
- Respiro mínimo em volta = altura da letra "K" da logo. Largura mínima: 120 px (tela) / 30 mm (impresso).
- Sobre fundo escuro: logo original. Sobre claro: logo original sobre superfície branca (`cor.superficie.padrao`).

## Cor da marca

| Tema | Token | Valor | Uso |
|---|---|---|---|
| Claro | `cor.marca.principal` | `#0B7A53` | ação principal, seleção, foco |
| Escuro | `cor.marca.principal` | `#00E676` | ação principal, destaque, foco |

O verde é **a cor de ação**. Não use verde para decorar: se é verde, é clicável, selecionado ou "deu certo".
Vermelho é só para perigo/erro; amarelo/laranja só para atenção. Ver [01-fundamentos/cor.md](../01-fundamentos/cor.md).

## Tipografia da marca

| Face | Fonte | Onde |
|---|---|---|
| Destaque (público) | **Anton**, MAIÚSCULAS | títulos de página e números de pódio do site/totem |
| Interface (público e admin web) | **Rajdhani** | corpo, rótulos, botões |
| Interface (apps nativos) | **Segoe UI** | todas as telas da Cronometragem e Recepção |
| Números | **Cascadia Mono / Consolas** (ou `tabular-nums`) | tempos de volta, contadores, valores |

## Linguagem visual

- **Claro (operação)**: fundo `#F5F5F7`, cartões brancos arredondados, sombra suave, ícones em quadradinho com
  degradê (estilo Ajustes do Mac), controles segmentados, rodapé de status com bolinhas. Densidade alta, sem
  ornamento. Referência: `desktop/design-aprovado/*.dc.html`.
- **Escuro (público)**: preto-box `#030504`, superfícies `#0B100C`, verde neon, botão chanfrado (clip-path) no site,
  títulos Anton gigantes, fotografia de pista. Referência: `design-source/*.dc.html` e [`DESIGN.md`](../../../DESIGN.md).
- **3D**: não usamos componentes 3D. Profundidade só por elevação (sombra/superfície) — ver
  [01-fundamentos/elevacao.md](../01-fundamentos/elevacao.md). Ícones em quadradinho com degradê suave são o máximo de
  "volume" permitido.

## Voz

Português do Brasil, frases curtas, verbo no botão ("Salvar", "Trocar kart", "Dar a verde"), sem jargão técnico para o
cliente, vocabulário de pista para o cronometrista ("bateria", "tomada de tempo", "quadriculada").
Ver [01-fundamentos/conteudo-e-mensagens.md](../01-fundamentos/conteudo-e-mensagens.md).
