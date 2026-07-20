# Ledger de fidelidade visual — Fundação pública

## Evidência

Workflow: `Public UI Baseline`

Execução inicial:

```txt
29764790834
```

Artefato:

```txt
public-ui-baseline-a9a3633bafe6cd72b5e6a37f62ec4177d7ea0f7b
```

Viewports comparados:

- 390 × 844;
- 820 × 1180;
- 1440 × 900.

Páginas analisadas:

- Home;
- Pista;
- Kart de Locação;
- Reservas;
- Eventos;
- Campeonatos;
- História;
- Dúvidas;
- KAC;
- KAC Super;
- 200 Milhas;
- 500 Milhas;
- Clube de Vantagens.

## Conclusão principal

A implementação Next atual já preserva grande parte da identidade premium no desktop e supera as referências `.dc` em responsividade. A migração não deve reproduzir literalmente os documentos antigos. O trabalho correto é consolidar o sistema visual, corrigir componentes compartilhados e transferir os melhores elementos editoriais das referências sem importar seus defeitos estruturais.

## Evidência de responsividade

Todas as capturas Next mobile possuem exatamente 390 px de largura e não apresentam overflow no screenshot completo.

Todas as referências `.dc` disponíveis apresentam overflow no viewport mobile:

| Página | Largura esperada | Largura capturada da referência | Excesso |
| --- | ---: | ---: | ---: |
| Home | 390 | 657 | 267 px |
| Pista | 390 | 548 | 158 px |
| Kart de Locação | 390 | 672 | 282 px |
| Eventos | 390 | 632 | 242 px |
| Campeonatos | 390 | 474 | 84 px |
| Dúvidas | 390 | 528 | 138 px |
| KAC | 390 | 528 | 138 px |
| KAC Super | 390 | 476 | 86 px |
| 200 Milhas | 390 | 505 | 115 px |
| 500 Milhas | 390 | 525 | 135 px |
| Clube de Vantagens | 390 | 418 | 28 px |

A referência da Home também apresenta overflow em tablet: 889 px renderizados dentro de um viewport de 820 px.

## Comparação por aspecto

### 1. Primeiro viewport

**Referência:** impacto tipográfico maior, headline curta e comercial, mídia escura com composição cinematográfica e card de preço integrado.

**Next atual:** composição forte e coerente, proposta institucional mais ampla, CTAs claros e melhor adaptação mobile. Porém o topo ocupa espaço demais por causa da topbar e do Header separados.

**Decisão:** manter a proposta institucional ampla da aplicação Next, reduzir altura do shell e reforçar a tipografia editorial. Não substituir a Home por uma página exclusiva de aniversário.

### 2. Navegação

**Referência:** menu desktop mais curto, visualmente limpo e um CTA primário destacado.

**Next atual:** doze links no desktop, fonte entre 11 e 12 px, topbar com telefone, endereço, horários e três redes sociais. A densidade prejudica descoberta e aumenta o tempo até o conteúdo.

**Decisão:** reduzir a navegação principal para os destinos essenciais e mover links secundários para menus ou Footer. Manter um único CTA de reserva. Em mobile, transformar o menu em drawer acessível e diminuir a altura anterior ao hero.

### 3. Tipografia

**Referência:** display condensado, agressivo e consistente; melhor contraste entre títulos, labels e corpo.

**Next atual:** a intenção visual é semelhante, mas as variáveis Tailwind `--font-display`, `--font-race` e `--font-body` não estão ligadas às fontes carregadas no Root Layout. O CSS ainda declara Inter e Montserrat globalmente, criando resultados dependentes de fallback.

**Decisão:** carregar Anton e Rajdhani com `next/font`, conectar as variáveis corretas e eliminar declarações conflitantes.

### 4. Paleta e superfícies

**Referência:** fundo escuro consistente, verde usado como sinal e não como decoração constante.

**Next atual:** páginas já utilizam `ink-*`, mas `src/index.css` ainda força body branco, textos zinc e utilitários verdes escurecidos com `!important`. O resultado depende da ordem de CSS.

**Decisão:** escopo `.public-site`, tokens escuros explícitos e remoção de overrides globais de tema claro. Admin e telão permanecem fora do escopo.

### 5. Hero e mídia

**Referência:** mídia e headline ocupam o primeiro viewport com pouca distração.

**Next atual:** vídeo, duas ações, localização, quatro métricas e card lateral. A informação é completa, mas o primeiro viewport fica mais denso.

**Decisão:** simplificar o hero mobile, preservar preço e reserva, reduzir informação secundária e mover detalhes para a seção seguinte. Carregar vídeo somente quando apropriado e usar poster em redução de movimento/economia de dados.

### 6. Métricas

**Referência:** rail compacto com quatro benefícios ou indicadores.

**Next atual:** quatro contadores grandes e animados. A captura inicial mostrou valores intermediários porque o screenshot ocorria antes de terminar o count-up.

**Decisão:** manter indicadores reais, garantir valor final determinístico, reduzir dependência de animação e usar layout 2 × 2 no mobile, 4 × 1 no desktop.

### 7. Ritmo e comprimento da Home

Altura das capturas:

| Viewport | Next | Referência | Relação aproximada |
| --- | ---: | ---: | ---: |
| Mobile | 16.876 px | 8.221 px | 2,05 × |
| Tablet | 12.979 px | 5.781 px | 2,25 × |
| Desktop | 10.603 px | 5.225 px | 2,03 × |

A referência possui áreas finais incompletas e não deve definir sozinha a altura ideal. Ainda assim, a Home Next repete vários blocos de oferta, modalidades, promoções, galeria, contato e CTA final.

**Decisão:** preservar o conteúdo comercial, mas consolidar seções redundantes, reduzir padding excessivo e criar alternância de ritmo. Meta inicial: reduzir entre 20% e 30% da altura sem remover informações essenciais.

### 8. Pista

As versões desktop são próximas. A Next apresenta título maior, melhor legibilidade e conteúdo mais extenso. A referência é mais compacta.

**Decisão:** preservar o layout Next e aplicar tokens, shell e compactação. Priorizar mapas ampliáveis e seleção de traçado no mobile em etapa própria.

### 9. Eventos

A Next possui melhor hierarquia do hero e galeria mais útil. A referência possui título mais compacto e melhor equilíbrio horizontal.

**Decisão:** manter a estrutura Next, reduzir quebra excessiva do título e melhorar largura de texto entre 1024 e 1440 px.

### 10. Campeonatos

As duas versões são visualmente próximas. A referência apresenta cards mais largos e densidade menor; a Next possui mais espaço vertical e CTAs mais numerosos.

**Decisão:** manter a fonte de dados e componentes Next, consolidar ações por status e compactar cards sem comprometer leitura.

### 11. Mobile compartilhado

A implementação Next apresenta um padrão consistente em todas as páginas:

- topbar em duas linhas;
- Header separado;
- hero;
- botão flutuante do WhatsApp;
- barra fixa inferior com Reserva e WhatsApp.

O padrão funciona, mas topbar + Header + barra inferior consomem grande parte do viewport. O WhatsApp aparece simultaneamente no hero, flutuante e na barra inferior em algumas páginas.

**Decisão:** reduzir duplicação de ações. Manter CTA fixo inferior apenas em rotas comerciais e remover o botão flutuante quando a mesma ação já estiver fixa.

## O que será preservado

- fundo escuro e verde da marca;
- títulos condensados e angulares;
- fotografia real;
- botões com corte diagonal;
- divisórias e linhas inspiradas em pista;
- propostas e preços oficiais;
- responsividade da implementação Next;
- conteúdo no HTML inicial;
- rotas, SEO e smoke tests atuais.

## O que será corrigido na primeira entrega

1. fontes e variáveis tipográficas;
2. escopo visual `.public-site`;
3. remoção de regras globais de tema claro;
4. Header e topbar mais compactos;
5. menu mobile acessível;
6. Footer legível com texto auxiliar de no mínimo 14 px;
7. botões e headings compartilhados;
8. hero e primeiras seções da Home;
9. duplicação de CTAs no mobile;
10. altura e ritmo da Home.

## Desvios intencionais da referência

- não reproduzir grids rígidos que causam overflow mobile;
- não transformar a Home em campanha exclusiva de aniversário;
- não reduzir textos auxiliares para 10–12 px;
- não depender de hover para revelar conteúdo;
- não restaurar o runtime `.dc`;
- não copiar dados inconsistentes de métricas ou calendário.
