# Web — site público, reservas e admin (Next.js na Cloudflare)

| Parte | Tema | Pasta |
|---|---|---|
| Site público | escuro | `app/[[...slug]]`, `src/components/*`, `src/components/site-ui/*` |
| Reservas online | escuro | `app/[[...slug]]` (reservas) + `src/components/Booking.tsx`, `QuickBooking.tsx` |
| Admin | **claro** | `app/admin/*`, `components/admin/*` |
| Telão (rotas) | congelado | `app/telao`, `app/placar-telao*`, `app/podio-*` |

## Tokens
`styles/tokens.css` é importado em `app/layout.tsx` antes de `globals.css`.
```css
.cartao {
  background: var(--kib-cor-superficie-padrao);
  border-radius: var(--kib-raio-cartao);
  box-shadow: var(--kib-elevacao-1);
  padding: var(--kib-espaco-3);
}
```
- Escuro é o padrão (`:root`). Admin: `data-tema="claro"` (ou `"escuro"`, pelo botão da lua) no `.admin-root` do
  `AdminShell` e no `.admin-login` (fase 4, feita).
- Tailwind: cores **`kib-*`** (em `tailwind.config.js`), apelidos das variáveis do tema do trecho — `bg-kib-fundo`,
  `bg-kib-superficie`, `bg-kib-campo`, `border-kib-borda`/`-forte`, `text-kib-texto`/`-2`/`-3`, `bg-kib-acao` +
  `text-kib-sobre-acao`, `text-kib-{sucesso,perigo,aviso,info}` com `-fundo`/`-solido`, `kib-roxo`, `bg-kib-sobreposicao`.
  Opacidade funciona (`bg-kib-acao/10` vira `color-mix`). Proibido: `bg-[#030504]`, `text-red-600`, `text-zinc-400`
  (o `lint:design` acusa).
- `--admin-*` (`styles/admin.css`) agora são só apelidos dos `--kib-*`; o remendo que forçava as classes `zinc` com
  `!important` saiu. As variáveis do `DESIGN.md` continuam; o teste garante que as cores-chave batem com os tokens.

## Regras
1. Mobile-first; sem rolagem horizontal da página em 360 px; toque ≥ 44×44 abaixo de 1024.
2. Fontes pelo `next/font`: Anton (títulos), Rajdhani (corpo) e **Oswald** só em `font-race` (números e rótulos de
   corrida em /reservas e /historia — mantida por já estar em uso, sem efeito em outras telas). Nada de `font-family`
   solto no CSS; Inter/Montserrat do site antigo saíram (nunca eram carregadas).
3. Ícones `lucide-react`.
4. `prefers-reduced-motion` respeitado.
5. Depois de publicar: purgar o cache e verificar com Playwright em 390, 768 e 1440.
6. Nada de segredo no código (o repositório é público); segredos via `wrangler secret`.
