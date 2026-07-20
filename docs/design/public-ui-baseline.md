# Baseline visual do site público

## Objetivo

Criar uma referência reproduzível para comparar a aplicação Next canônica com os documentos premium em `public/design/*.dc.html` sem servir esses documentos como páginas de produção.

## Workflow

Arquivo:

```txt
.github/workflows/public-ui-baseline.yml
```

Teste:

```txt
tests/capture-public-ui.spec.ts
```

O workflow executa build de produção, inicia o servidor Next e captura screenshots completas com Chromium.

## Viewports

| Nome | Dimensão | Uso |
| --- | ---: | --- |
| Mobile | 390 × 844 | celulares modernos e verificação de empilhamento |
| Tablet | 820 × 1180 | tablet vertical e desktop estreito |
| Desktop | 1440 × 900 | comparação editorial principal |

## Páginas capturadas

- Home;
- Pista;
- Kart de Locação;
- Reservas;
- Eventos;
- Campeonatos;
- História;
- Dúvidas;
- KAC Iniciantes;
- KAC Super;
- 200 Milhas;
- 500 Milhas;
- Clube de Vantagens.

Quando existe um documento `.dc` equivalente, são gerados dois arquivos:

```txt
<viewport>--<pagina>--next.jpg
<viewport>--<pagina>--reference.jpg
```

Reservas e História possuem apenas a captura Next porque não existe referência `.dc` correspondente no inventário atual.

## Determinismo

Durante a captura:

- vídeos são bloqueados e pausados;
- animações e transições são desativadas;
- fontes aguardam `document.fonts.ready`;
- a captura utiliza o build de produção;
- cada viewport roda de forma serial;
- o relatório inclui um `manifest.json`.

## Artefato

O GitHub Actions publica:

```txt
public-ui-baseline-<commit-sha>
```

Retenção: 30 dias.

O artefato contém os screenshots, o manifesto e o log do servidor de produção.

## Critérios de comparação

Cada par deve ser inspecionado em pelo menos estes pontos:

1. primeiro viewport e hierarquia da oferta;
2. navegação, logo e CTA principal;
3. tipografia, quebras e legibilidade;
4. paleta, contraste e tratamento de mídia;
5. grid, margens, espaçamento e densidade;
6. ritmo entre seções;
7. comportamento mobile e tablet;
8. componentes interativos e áreas de toque.

## Regra de produção

Os documentos `.dc` são apenas referências visuais. Nenhuma rota pública pode redirecionar, incorporar ou depender deles em produção.
