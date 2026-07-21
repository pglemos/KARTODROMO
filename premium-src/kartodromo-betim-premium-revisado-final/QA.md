# Relatório de auditoria e validação

## Escopo

Auditoria integral das dez páginas HTML, do CSS compartilhado, JavaScript, imagens, vídeo, PDFs, navegação, formulários e comportamento responsivo.

## Problemas encontrados no pacote anterior

A inspeção inicial detectou **190 ocorrências estruturais**, além de defeitos renderizados:

- 100 links com `target="_blank"` sem proteção `noopener`.
- 40 botões sem `type`, sujeitos a submissões involuntárias.
- 10 controles de formulário sem rótulo acessível.
- 20 landmarks de navegação sem nome acessível.
- 10 páginas sem favicon.
- Overflow horizontal de até 163 px em telas móveis.
- Conteúdo `.reveal` invisível quando o JavaScript não carregava.
- Contadores exibindo `0` na ausência de JavaScript.
- Menu mobile, FAQ, mapa de pista e modais com estados ARIA incompletos.
- Elementos tipográficos e grids com comportamento de `min-content` provocando quebras.
- Pasta final inflada por arquivos duplicados e previews não utilizados.
- Script antigo de QA verificava apenas a existência superficial das páginas.

## Correções aplicadas

- Padronização semântica de `header`, `main`, `footer`, títulos e navegações.
- Ligação de salto para o conteúdo principal e foco visível em teclado.
- `rel="noopener noreferrer"` em links externos.
- `type` explícito em todos os botões.
- Labels associados a todos os campos de formulário.
- Estados `aria-expanded`, `aria-selected`, `aria-hidden`, `aria-pressed` e `inert` sincronizados.
- Modal com foco inicial, contenção de foco, fechamento por Escape e restauração de foco.
- Menu mobile com bloqueio fora do estado aberto e fechamento por Escape.
- FAQ e traçado interativo corrigidos para mouse, toque e teclado.
- Conteúdo de fallback visível quando o JavaScript falha.
- Contadores com valores úteis no HTML antes da animação.
- Scroll e parallax agrupados com `requestAnimationFrame`.
- Proteções responsivas para grids, títulos, tabelas, mosaicos, formulários e rodapé.
- `prefers-reduced-motion` respeitado.
- Remoção de cópias, uploads e previews sem referência, reduzindo o projeto para cerca de 27 MB.
- Novo `qa_check.py` sem dependências externas.

## Validações executadas

| Verificação | Resultado |
|---|---:|
| Páginas HTML principais | 10/10 aprovadas |
| HTML Validate | 0 erros |
| Sintaxe JavaScript (`node --check`) | aprovada |
| Links e ativos locais | 0 ausentes |
| IDs duplicados | 0 |
| Links `_blank` sem `noopener` | 0 |
| Botões sem `type` | 0 |
| Campos sem nome acessível | 0 |
| Erros de console no Chromium | 0 |
| Avisos de console relevantes | 0 |
| Imagens quebradas | 0 |
| Overflow horizontal | 0 em todas as páginas testadas |
| Desktop 1440 × 1000 | 10/10 aprovadas |
| Mobile 390 × 844 | 10/10 aprovadas |

## Fluxos de interação testados

- Menu mobile: abrir e fechar nas dez páginas.
- Home e Eventos: abrir modal e fechar pelo teclado.
- Pista: alternar o traçado e atualizar o desenho.
- Dúvidas: abrir resposta e aplicar filtro de categoria.
- Scroll, progress bar, reveals e contadores: inicialização sem erro de runtime.

## Mídia validada

- Vídeo H.264, 1280 × 720, duração aproximada de 22,29 segundos.
- Regulamento 200 Milhas: 10 páginas.
- Regulamento 500 Milhas: 11 páginas.
- Regulamento KAC Iniciantes: 6 páginas.
- Regulamento KAC Super: 7 páginas.
- Assinaturas de PNG, JPEG, PDF e MP4 verificadas.

## Ambiente de QA renderizado

O plugin Browser não estava disponível nesta sessão. A validação visual e funcional utilizou **Playwright com Chromium**, carregando HTML, CSS, JavaScript e imagens locais em um documento renderizado. Essa abordagem contornou a política administrativa que bloqueava navegação direta para `file://` e `localhost`, sem alterar o código entregue.

## Limitação conhecida

Os anexos fornecidos mostram o desenho das fontes Brake Disc e Pace Racing Car Modern, mas não incluem arquivos licenciados `.woff2`, `.otf` ou `.ttf`. O projeto não redistribui binários de fonte. O CSS utiliza as fontes quando instaladas localmente e mantém fallbacks compatíveis nos demais computadores.
