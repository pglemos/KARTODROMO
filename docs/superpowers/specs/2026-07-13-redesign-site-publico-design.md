# Redesign do site público — Kartódromo Internacional de Betim

Data: 2026-07-13

## Objetivo

Redesenhar visualmente todas as páginas públicas de `kartodromodebetim.com.br`, usando como referência de design o rascunho estático (`kartodromo-betim-premium-revisado.zip`) que o usuário produziu, melhorando o que for possível em cima dele. O conteúdo e as funcionalidades reais que já existem no site (inscrição de campeonatos, agendamento, preços, calendários) são preservados — só a "roupa" visual muda.

## Contexto

O site público hoje é uma SPA React (`react-router-dom`) embutida dentro do app Next.js, montada em `app/[[...slug]]/page.tsx` → `app/PublicSiteClient.tsx` → `src/App.tsx`. Usa Tailwind CSS. Rotas atuais:

- `/` — `Home.tsx` (Header, Hero, About, Booking, Services, Promotions, Contact, Footer)
- `/historia` — `HistoryPage.tsx`
- `/duvidas` — `FAQPage.tsx`
- `/eventos` — `EventsPage.tsx`
- `/pista` — `PistaPage.tsx`
- `/kart-locacao` — `KartLocacaoPage.tsx`
- `/reservas` — `ReservasPage.tsx` (usa `QuickBooking.tsx`)
- `/campeonatos` — `ChampionshipsPage.tsx` (usa `Championships.tsx`, 789 linhas — cards de campeonato + formulário de inscrição real, grava em `/api/inscricao`)
- `/campeonatos/kac` — `KACPage.tsx` (550 linhas — página completa: estrutura, calendário, pontuação, regulamento, premiação, punições, contato)

O painel administrativo (`src/admin/**`) tem layout próprio e não é afetado por este trabalho.

O usuário forneceu um rascunho estático (HTML/CSS/JS puro, 10 páginas, ~27MB com mídia) com uma identidade visual editorial de automobilismo: tema escuro (preto/branco/verde), tipografia grande em itálico maiúsculo, vídeo de fundo no hero, contadores animados, cards em formato "poster" com recorte angular (`clip-path`), painel de vidro (glass panel), faixa com ticker animado, mapa de pista interativo, FAQ com filtro lateral e acordeão, formulário modal que monta uma mensagem de WhatsApp.

### Restrição crítica descoberta durante a análise

O componente `QuickBooking.tsx` documenta um incidente real: até 2026-07-02 o site tinha um proxy que espelhava a página de agendamento da MyLapTime (`tools.mylaptime.com.br`) sob o domínio do Kartódromo. A Sisecom (fabricante do MyLapTime) abriu uma denúncia formal de abuso no Cloudflare por personificação de marca / violação de marca registrada / coleta de PII, e o Cloudflare passou a bloquear o site como "Suspected Phishing". O proxy foi removido — hoje o CTA de agendamento é só um link externo (`target="_blank"`) para o domínio oficial da MyLapTime.

**Esta restrição é permanente e vale para todo o redesign**: nenhum CTA de agendamento pode voltar a clonar/incorporar (iframe) a página da MyLapTime sob nosso domínio. Só link externo. (Registrado também em memória de projeto: `no-mylaptime-proxy`.)

## Decisões (tomadas com o usuário)

1. **Escopo**: refazer todas as páginas do rascunho + restilizar História e Reservas (que não estão no rascunho) + criar as 3 páginas de campeonato que faltam (KAC Super, 200 Milhas, 500 Milhas).
2. **Tipografia**: como "Brake Disc" e "Pace Racing Car Modern" são fontes pagas sem arquivo incluído no rascunho, uso substitutas gratuitas do Google Fonts com visual parecido — **Anton** para títulos grandes (display) e **Oswald** para rótulos/menu em itálico. **Rajdhani** (fonte de corpo do rascunho) já é gratuita e é mantida.
3. **Arquitetura**: reconstruir em React + Tailwind (não importar o CSS/JS puro do rascunho), reaproveitando a paleta `primary` do Tailwind já existente (`primary-400 = #00e676` já é o verde do rascunho) e criando componentes visuais reutilizáveis. Interações (menu mobile, modal, FAQ, contador, mapa de pista) reimplementadas como componentes React acessíveis (foco, ARIA, `prefers-reduced-motion`), não o `site.js` puro do rascunho.
4. **Mídia**: vídeo do hero, fotos de eventos/história do rascunho e os 3 PDFs de regulamento novos (200 Milhas, 500 Milhas, KAC Super) vão para um bucket Cloudflare R2, servidos por URL pública. Mídia que já está publicada em `public/` (logos de campeonato, PDF do KAC Iniciantes) permanece como está — não será migrada, para não arriscar quebrar algo que já funciona.
5. **Deploy**: apenas entregar o código pronto e testado localmente. Não faço deploy de produção nesta etapa — isso é decisão separada do usuário depois de revisar.
6. **Novas rotas de campeonato**: nested sob `/campeonatos/...` (`/campeonatos/kac-super`, `/campeonatos/200-milhas`, `/campeonatos/500-milhas`), seguindo o padrão que `/campeonatos/kac` já usa.

## Design tokens

- **Cor**: reaproveitar `primary` (Tailwind) como verde de destaque. Adicionar tons escuros de fundo/superfície equivalentes aos do rascunho (`--bg:#030504`, `--surface:#0b100c` etc.) como novos tokens Tailwind (`neutral` estendido ou nova escala `ink`), para não colidir com o que já existe.
- **Tipografia**: `font-display` = Anton (títulos grandes, itálico sintético via CSS); `font-race` = Oswald itálico (rótulos, menu, eyebrow); `font-body` = Rajdhani (texto corrido). Self-hospedadas via `next/font` (sem dependência de CDN externo).
- **Padrões visuais a portar como componentes**: `Section` (com `eyebrow` + título), `StatCounter` (contador animado com fallback estático sem JS), `PosterCard` (card com recorte angular e imagem com overlay), `GlassPanel`, `Ticker` (faixa animada), `AccordionFAQ` (com filtro lateral), `TrackMap` (mapa interativo com abas de traçado), `TimelineItem` (para História).

## Escopo por página

| Página | Rota | Ação |
|---|---|---|
| Home | `/` | Redesign completo: hero com vídeo, telemetria, cards de formato de evento, "como funciona", galeria, diferenciais, CTA final |
| Pista | `/pista` | Redesign + mapa de pista interativo (dados reais de traçado, não os do rascunho) |
| Locação de Kart | `/kart-locacao` | Redesign |
| Eventos | `/eventos` | Redesign (mosaico com fotos reais do acervo `FOTOS KARTODROMO.zip`, não as fotos genéricas do rascunho) |
| Dúvidas | `/duvidas` | Redesign (FAQ com filtro lateral + acordeão), mantendo as perguntas/respostas reais já cadastradas em `FAQ.tsx` |
| História | `/historia` | Redesign em formato timeline, mantendo o texto real já existente em `History.tsx` |
| Reservas | `/reservas` | Redesign da seção, **mantendo o link externo para MyLapTime** (nunca iframe/proxy) |
| Campeonatos | `/campeonatos` | Redesign dos cards, **mantendo 100% a lógica de inscrição real** (estado React, `fetch('/api/inscricao')`, campos de equipe vs individual) |
| KAC Iniciantes | `/campeonatos/kac` | Redesign, mantendo calendário/regras/preços reais e o link de download do PDF existente |
| KAC Super Kart | `/campeonatos/kac-super` | **Nova página**, no mesmo padrão da página do KAC, com formulário de inscrição real (reaproveitando o modal de `Championships.tsx`) e PDF de regulamento (R2) |
| 200 Milhas | `/campeonatos/200-milhas` | **Nova página**, idem |
| 500 Milhas | `/campeonatos/500-milhas` | **Nova página**, idem |

Nota: onde o rascunho tem conteúdo/fotos fictícios ou genéricos (preços de exemplo, fotos de banco de imagens), a cópia final usa os dados reais que já existem no site atual (preços, datas, endereço, telefone, WhatsApp já coincidem entre o rascunho e o site — foram conferidos).

## Mídia e R2

- Criar bucket R2 dedicado (usando as credenciais fornecidas pelo usuário nesta conversa).
- Upload: vídeo do hero (`home-karting.mp4`, 2.7MB), fotos reais curadas do acervo `FOTOS KARTODROMO.zip` (subconjunto relevante das 113 fotos, não o acervo inteiro), PDFs de regulamento de 200 Milhas (460KB), 500 Milhas (1.4MB) e KAC Super (896KB).
- O site referencia essas mídias por URL pública do R2 (não por proxy/rewrite).
- Não migrar mídia que já está em `public/` e já funciona (logos de campeonato, PDF do KAC Iniciantes).

## Fases de execução

1. Base: fontes (Anton/Oswald via `next/font`), tokens de cor escuros, componentes visuais reutilizáveis, Header/Footer novos.
2. Home.
3. Pista, Kart-Locação, Eventos, Dúvidas, História.
4. Campeonatos (`/campeonatos`, `/campeonatos/kac` restilizados) + 3 páginas novas (KAC Super, 200 Milhas, 500 Milhas) com inscrição real.
5. Reservas.
6. Upload de mídia para R2 e atualização dos caminhos.

Cada fase é validada rodando localmente (`npm run dev`) antes de avançar para a próxima.

## Fora de escopo

- Deploy de produção no Cloudflare (fica para decisão posterior do usuário).
- Alterar o painel administrativo.
- Alterar a lógica de negócio de inscrição/agendamento (`/api/inscricao`, integração MyLapTime) — só o visual em torno dela.
- Comprar/licenciar as fontes originais do rascunho (Brake Disc, Pace Racing Car Modern).
- Recriar o proxy/iframe da MyLapTime sob o domínio do Kartódromo — proibido (ver restrição crítica acima).

## Fotos reais (resolvido)

As 7 fotos de "eventos" do rascunho eram, na prática, fotos da estrutura (lanchonete, salão, varanda, sala de briefing) com legendas erradas de corrida/pódio — não seriam usadas como estavam. O usuário forneceu um acervo real (`FOTOS KARTODROMO.zip`, 113 fotos: pilotos na pista, chegada com bandeira quadriculada, grid de karts, painel de cronometragem, retrato de piloto, estrutura do complexo à noite). Esse acervo passa a ser a fonte real de imagens para Home, Eventos, História e Campeonatos — a curadoria de qual foto vai em qual seção é detalhe de implementação, feita durante a execução de cada fase. Algumas fotos do acervo já são posts prontos de Instagram (com texto sobreposto) — essas não entram como imagem "crua" de seção, só como eventual referência.
