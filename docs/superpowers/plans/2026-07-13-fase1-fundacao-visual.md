# Fase 1 — Fundação visual do redesign do site público

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base do novo visual (fontes, cores escuras, componentes reutilizáveis, Header e Footer) usada por todas as páginas públicas do site, sem tocar no painel admin, no telão, ou no CSS global compartilhado por eles.

**Architecture:** As fontes e o tema escuro são carregados só dentro de `app/[[...slug]]/layout.tsx` (layout aninhado do App Router que envolve apenas as rotas do site público), não no `app/layout.tsx` raiz. Cores escuras entram como extensão do Tailwind (`tailwind.config.js`), sem remover nada que já existe. Componentes visuais novos vivem em `src/components/site-ui/`. Header/Footer são reescritos com o novo visual mas mantêm exatamente os mesmos dados reais (telefone, WhatsApp, e-mail, endereço, horários, redes sociais) e os mesmos links de navegação já existentes.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, `next/font/google`, Vitest.

## Global Constraints

- Nunca alterar `styles/globals.css` ou o comportamento visual do painel admin (`src/admin/**`) ou do telão (`app/telao/**`, `app/placar-telao*/**`) — esses usam o CSS global compartilhado (`:root` com tema teal) e não fazem parte deste redesign.
- Nunca remover ou renomear tokens Tailwind existentes (`primary`, `secondary`, `neutral`) — só adicionar.
- Preservar exatamente os dados reais já existentes no Header/Footer: telefone `(31) 3511-2373` (`tel:+553135112373`), WhatsApp `(31) 99884-2898` (`https://wa.me/5531998842898`), e-mail `contato@kartodromodebetim.com.br`, endereço `Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG, 32672-586`, horários (Ter-Sex 16h-22h, Sáb-Dom 08h-19h, Segunda fechado), redes sociais (Facebook/Instagram/YouTube já linkados). Não inventar nem alterar nenhum desses valores.
- Não mudar os destinos de link do menu (`/#sobre`, `/#servicos`, `/pista`, `/kart-locacao`, `SITE_BOOKING_ANCHOR`, `/campeonatos`, `/eventos`, `/duvidas`, `/#contato`) — isso é ajustado nas fases seguintes, quando as páginas em si mudarem de estrutura.
- Componentes puramente visuais (sem lógica não-trivial) são verificados rodando `npm run dev` e inspecionando no navegador — este projeto não tem `jsdom`/React Testing Library configurados (`vitest.config.ts` usa `environment: 'node'` e só inclui `app/**` e `lib/**`), então não forçamos testes de render de componente. Lógica pura (cálculos, funções sem DOM) sempre ganha teste real em `lib/**`.

---

## Estrutura de arquivos desta fase

- Modificar: `tailwind.config.js` — adicionar escala de cor `ink` (fundo escuro) e `fontFamily` (`display`, `race`, `body`).
- Criar: `lib/animate-count.ts` + `lib/animate-count.test.ts` — matemática pura do contador animado.
- Criar: `app/[[...slug]]/layout.tsx` — carrega as fontes (Anton, Oswald, Rajdhani) e envolve o site público com a classe do tema escuro. Só afeta rotas do site público.
- Criar: `src/components/site-ui/SectionHeading.tsx`
- Criar: `src/components/site-ui/GlassPanel.tsx`
- Criar: `src/components/site-ui/AngledButton.tsx`
- Criar: `src/components/site-ui/Ticker.tsx`
- Criar: `src/components/site-ui/PosterCard.tsx`
- Criar: `src/components/site-ui/StatCounter.tsx`
- Modificar: `src/components/Header.tsx` — reescrita visual, mesmos dados/links.
- Modificar: `src/components/Footer.tsx` — reescrita visual, mesmos dados/links.

---

### Task 1: Tokens de cor escura e tipografia no Tailwind

**Files:**
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: classes Tailwind `bg-ink-950`, `bg-ink-900`, `bg-ink-800`, `bg-ink-700`, `bg-ink-600`, `text-ink-950` etc. (escala `ink`); `font-display`, `font-race`, `font-body` (famílias de fonte, usadas pelas tasks seguintes via as variáveis CSS `--font-display`, `--font-race`, `--font-body` que a Task 3 vai definir).

Este token é dado estático (cores hex), não lógica — não há nada de not-trivial pra testar aqui. A verificação real é visual, feita no fim da fase (Task 8).

- [ ] **Step 1: Editar `tailwind.config.js`**

Adicionar a escala `ink` dentro de `theme.extend.colors` (mantendo `primary`, `secondary`, `neutral` como estão) e adicionar `theme.extend.fontFamily`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8fbf3',
          100: '#bbf7dd',
          200: '#7ff0bd',
          300: '#3ce396',
          400: '#00e676',
          500: '#00c853',
          600: '#009e3e',
          700: '#007a30',
          800: '#056027',
          900: '#064f22',
          950: '#022c12',
        },
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        neutral: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        ink: {
          950: '#030504',
          900: '#070b08',
          800: '#0b100c',
          700: '#101711',
          600: '#151e16',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Arial Black', 'Impact', 'sans-serif'],
        race: ['var(--font-race)', 'Arial Narrow', 'Arial', 'sans-serif'],
        body: ['var(--font-body)', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Verificar que o projeto ainda builda a config sem erro**

Run: `npx tailwindcss -i ./src/index.css -o /tmp/tailwind-check.css --config tailwind.config.js`
Expected: comando termina sem erro e gera `/tmp/tailwind-check.css` (não precisa inspecionar o conteúdo agora, só confirmar que a config é válida).

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat(site): add dark ink color scale and display/race/body font tokens"
```

---

### Task 2: Matemática do contador animado (`lib/animate-count.ts`)

**Files:**
- Create: `lib/animate-count.ts`
- Test: `lib/animate-count.test.ts`

**Interfaces:**
- Produces: `getCountUpValue(elapsedMs: number, durationMs: number, target: number): number` — usada pela Task 4 (`StatCounter.tsx`).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `lib/animate-count.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getCountUpValue } from './animate-count';

describe('getCountUpValue', () => {
  it('retorna 0 no instante inicial', () => {
    expect(getCountUpValue(0, 1000, 100)).toBe(0);
  });

  it('retorna o valor alvo quando o tempo decorrido alcança a duração', () => {
    expect(getCountUpValue(1000, 1000, 100)).toBe(100);
  });

  it('retorna o valor alvo quando o tempo decorrido passa da duração', () => {
    expect(getCountUpValue(5000, 1000, 100)).toBe(100);
  });

  it('aplica easing ease-out-cubic na metade do tempo', () => {
    // progress = 0.5 -> eased = 1 - (1-0.5)^3 = 0.875 -> round(87.5) = 88
    expect(getCountUpValue(500, 1000, 100)).toBe(88);
  });

  it('nunca retorna valor negativo quando elapsedMs é negativo', () => {
    expect(getCountUpValue(-200, 1000, 100)).toBe(0);
  });

  it('retorna o alvo imediatamente quando durationMs é zero ou negativo', () => {
    expect(getCountUpValue(0, 0, 42)).toBe(42);
    expect(getCountUpValue(0, -10, 42)).toBe(42);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/animate-count.test.ts`
Expected: FAIL — `Cannot find module './animate-count'` (o arquivo de implementação ainda não existe).

- [ ] **Step 3: Implementar `lib/animate-count.ts`**

```ts
export function getCountUpValue(elapsedMs: number, durationMs: number, target: number): number {
  if (durationMs <= 0) {
    return target;
  }

  const progress = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  const eased = 1 - Math.pow(1 - progress, 3);

  return Math.round(target * eased);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/animate-count.test.ts`
Expected: PASS — 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/animate-count.ts lib/animate-count.test.ts
git commit -m "feat(site): add pure ease-out count-up math for animated stat counters"
```

---

### Task 3: Fontes e layout aninhado do site público

**Files:**
- Create: `app/[[...slug]]/layout.tsx`

**Interfaces:**
- Consumes: nenhuma interface de outra task.
- Produces: variáveis CSS `--font-display`, `--font-race`, `--font-body` disponíveis em toda a árvore de rotas do site público (aplicadas via `className` num `<div>` wrapper), consumidas pelo `fontFamily` do Tailwind configurado na Task 1. Também produz a classe de fundo escuro `bg-ink-950 text-white` que serve de base para as páginas restilizadas nas fases seguintes.

- [ ] **Step 1: Criar `app/[[...slug]]/layout.tsx`**

```tsx
import { Anton, Oswald, Rajdhani } from 'next/font/google';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-race',
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export default function PublicSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${anton.variable} ${oswald.variable} ${rajdhani.variable} bg-ink-950 font-body text-white`}>
      {children}
    </div>
  );
}
```

Nota: este arquivo só se aplica à rota `app/[[...slug]]/page.tsx` (o site público). Rotas como `/admin`, `/telao`, `/placar-telao` têm seus próprios segmentos de rota e não usam este layout — o CSS global (`styles/globals.css`, tema teal) e a fonte deles continuam intocados.

- [ ] **Step 2: Verificar visualmente que a fonte carrega e o admin não foi afetado**

Run: `npm run dev`

No navegador:
1. Abrir `http://localhost:3000/` — confirmar no DevTools que o elemento wrapper tem `font-family` computado incluindo Anton/Oswald/Rajdhani (ainda sem uso visível, pois os componentes de página não usam essas classes até as próximas fases) e fundo escuro (`#030504`) visível atrás do conteúdo branco existente (é esperado ver uma faixa escura porque as páginas internas ainda forçam `bg-white` — isso é normal nesta fase e será resolvido quando cada página for restilizada).
2. Abrir `http://localhost:3000/admin/login` — confirmar que o visual do admin está exatamente como antes (fundo/fonte do tema teal, sem Anton/Oswald).

- [ ] **Step 3: Commit**

```bash
git add "app/[[...slug]]/layout.tsx"
git commit -m "feat(site): scope Anton/Oswald/Rajdhani fonts and dark theme to public site routes only"
```

---

### Task 4: Componente `StatCounter`

**Files:**
- Create: `src/components/site-ui/StatCounter.tsx`

**Interfaces:**
- Consumes: `getCountUpValue` de `lib/animate-count.ts` (Task 2).
- Produces: `<StatCounter target={number} suffix?={string} label={string} durationMs?={number} />`, usado pela Home e outras páginas nas fases seguintes.

- [ ] **Step 1: Implementar `src/components/site-ui/StatCounter.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { getCountUpValue } from '../../../lib/animate-count';

type StatCounterProps = {
  target: number;
  label: string;
  suffix?: string;
  durationMs?: number;
};

const StatCounter = ({ target, label, suffix = '', durationMs = 1400 }: StatCounterProps) => {
  const [value, setValue] = useState(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

    setValue(0);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      setValue(getCountUpValue(elapsed, durationMs, target));

      if (elapsed < durationMs) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, durationMs]);

  return (
    <div className="border-r border-white/10 p-7 last:border-r-0">
      <strong className="block font-display text-[clamp(48px,5vw,78px)] italic leading-[0.8] text-primary-400">
        {value}
        {suffix}
      </strong>
      <span className="mt-2 block font-race text-xs italic uppercase tracking-wider text-white/60">{label}</span>
    </div>
  );
};

export default StatCounter;
```

- [ ] **Step 2: Verificação manual**

Este componente ainda não é importado por nenhuma página nesta fase (isso acontece na Fase 2, na Home). Confirmar apenas que não há erro de tipos:

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `StatCounter.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/site-ui/StatCounter.tsx
git commit -m "feat(site): add StatCounter component with reduced-motion fallback"
```

---

### Task 5: Primitivas visuais restantes (`SectionHeading`, `GlassPanel`, `AngledButton`, `Ticker`, `PosterCard`)

**Files:**
- Create: `src/components/site-ui/SectionHeading.tsx`
- Create: `src/components/site-ui/GlassPanel.tsx`
- Create: `src/components/site-ui/AngledButton.tsx`
- Create: `src/components/site-ui/Ticker.tsx`
- Create: `src/components/site-ui/PosterCard.tsx`

**Interfaces:**
- Produces:
  - `<SectionHeading eyebrow={string} title={ReactNode} align?={'left' | 'center'} />`
  - `<GlassPanel>{children}</GlassPanel>`
  - `<AngledButton variant={'primary' | 'outline'} href?={string} onClick?={() => void} type?={'button' | 'submit'}>{children}</AngledButton>`
  - `<Ticker items={string[]} />`
  - `<PosterCard number={string} image={string} alt={string} title={string} description={string} ctaLabel={string} onCtaClick?={() => void} href?={string} />`
- Todos usados pela Home e demais páginas a partir da Fase 2.

- [ ] **Step 1: Implementar `src/components/site-ui/SectionHeading.tsx`**

```tsx
type SectionHeadingProps = {
  eyebrow: string;
  title: React.ReactNode;
  align?: 'left' | 'center';
};

const SectionHeading = ({ eyebrow, title, align = 'left' }: SectionHeadingProps) => {
  return (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <p className="mb-4 font-race text-xs italic font-bold uppercase tracking-[0.17em] text-primary-400 after:ml-3 after:content-['///']">
        {eyebrow}
      </p>
      <h2 className="font-display text-[clamp(40px,6vw,80px)] italic uppercase leading-[0.8] tracking-tight text-white">
        {title}
      </h2>
    </div>
  );
};

export default SectionHeading;
```

- [ ] **Step 2: Implementar `src/components/site-ui/GlassPanel.tsx`**

```tsx
const GlassPanel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={`relative overflow-hidden border border-white/15 bg-gradient-to-b from-ink-700/95 to-ink-900/95 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-primary-400 before:to-transparent ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
```

- [ ] **Step 3: Implementar `src/components/site-ui/AngledButton.tsx`**

```tsx
type AngledButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  external?: boolean;
  className?: string;
};

const baseClasses =
  'inline-flex min-h-[52px] items-center justify-center gap-2.5 px-7 font-race text-xs italic font-bold uppercase tracking-wide transition-transform duration-200 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] hover:-translate-y-1';

const variantClasses: Record<'primary' | 'outline', string> = {
  primary: 'bg-gradient-to-br from-primary-400 to-primary-600 text-ink-950 shadow-[0_18px_46px_rgba(0,230,118,0.25)]',
  outline: 'border border-white/25 bg-white/5 text-white backdrop-blur-md hover:border-primary-400 hover:text-primary-400',
};

const AngledButton = ({
  children,
  variant = 'primary',
  href,
  onClick,
  type = 'button',
  external = false,
  className = '',
}: AngledButtonProps) => {
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
};

export default AngledButton;
```

- [ ] **Step 4: Implementar `src/components/site-ui/Ticker.tsx`**

```tsx
type TickerProps = {
  items: string[];
};

const Ticker = ({ items }: TickerProps) => {
  const text = items.join(' • ');

  return (
    <div className="overflow-hidden bg-primary-400 py-5 text-ink-950" aria-hidden="true">
      <div className="flex w-max animate-[ticker_26s_linear_infinite] gap-6">
        <span className="whitespace-nowrap font-display text-[clamp(28px,4vw,60px)] italic uppercase leading-[0.75]">
          {text}
        </span>
        <span className="whitespace-nowrap font-display text-[clamp(28px,4vw,60px)] italic uppercase leading-[0.75]">
          {text}
        </span>
      </div>
    </div>
  );
};

export default Ticker;
```

Nota: `Ticker` é `aria-hidden="true"` porque é um elemento puramente decorativo (o mesmo texto repetido em loop visual) — leitores de tela não devem anunciá-lo, igual ao comportamento do rascunho original.

Este componente depende da animação `ticker` (`@keyframes ticker { to { transform: translateX(-50%) } }`). Adicionar em `src/index.css` (fora do bloco `@layer`, junto de outras keyframes já existentes no arquivo, se houver, ou ao final do arquivo):

```css
@keyframes ticker {
  to {
    transform: translateX(-50%);
  }
}
```

- [ ] **Step 5: Implementar `src/components/site-ui/PosterCard.tsx`**

```tsx
type PosterCardProps = {
  number: string;
  image: string;
  alt: string;
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  href?: string;
};

const PosterCard = ({ number, image, alt, title, description, ctaLabel, onCtaClick, href }: PosterCardProps) => {
  return (
    <article className="group relative isolate min-h-[460px] overflow-hidden border border-white/10 bg-ink-800 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)] transition-transform duration-500 hover:-translate-y-3 hover:border-primary-400/60">
      <img
        src={image}
        alt={alt}
        className="absolute inset-0 -z-20 h-full w-full object-cover brightness-[0.55] contrast-[1.15] grayscale-[0.2] transition-all duration-700 group-hover:scale-105 group-hover:brightness-[0.65] group-hover:grayscale-0"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />
      <span
        aria-hidden="true"
        className="absolute right-6 top-3 font-display text-[80px] italic text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.2)]"
      >
        {number}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-8">
        <h3 className="max-w-[8ch] font-display text-[clamp(34px,4vw,56px)] italic uppercase leading-[0.8] tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{description}</p>
        {href ? (
          <a
            href={href}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 font-race text-[11px] italic font-bold uppercase tracking-wide text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            {ctaLabel}
          </a>
        ) : (
          <button
            type="button"
            onClick={onCtaClick}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 px-5 font-race text-[11px] italic font-bold uppercase tracking-wide text-ink-950 [clip-path:polygon(7%_0,100%_0,93%_100%,0_100%)]"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
};

export default PosterCard;
```

- [ ] **Step 6: Verificação de tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos nos 5 arquivos criados.

- [ ] **Step 7: Commit**

```bash
git add src/components/site-ui/SectionHeading.tsx src/components/site-ui/GlassPanel.tsx src/components/site-ui/AngledButton.tsx src/components/site-ui/Ticker.tsx src/components/site-ui/PosterCard.tsx src/index.css
git commit -m "feat(site): add SectionHeading, GlassPanel, AngledButton, Ticker and PosterCard primitives"
```

---

### Task 6: Reescrita visual do `Header`

**Files:**
- Modify: `src/components/Header.tsx`

**Interfaces:**
- Consumes: `SITE_BOOKING_ANCHOR` de `../config/booking` (já existente, não muda).
- Produces: mesmo componente `Header` exportado como default, sem mudar sua assinatura (não recebe props), continua sendo importado da mesma forma pelas páginas existentes.

- [ ] **Step 1: Substituir o conteúdo de `src/components/Header.tsx`**

```tsx
import { useState } from 'react';
import { Menu, X, Phone, MapPin, Clock, Users as Facebook, Camera as Instagram, Video as Youtube } from 'lucide-react';
import { SITE_BOOKING_ANCHOR } from '../config/booking';

const navLinks = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Modalidades' },
  { href: '/pista', label: 'A Pista' },
  { href: '/kart-locacao', label: 'Locação' },
  { href: SITE_BOOKING_ANCHOR, label: 'Reservas Online' },
  { href: '/campeonatos', label: 'Campeonatos' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/duvidas', label: 'Dúvidas' },
  { href: '/#contato', label: 'Contato' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Top Bar */}
      <div className="border-b border-white/10 bg-ink-900 px-4 py-3 text-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-7 gap-y-2.5 font-race text-[13px] italic leading-none md:text-sm">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <a href="tel:+553135112373" className="flex items-center space-x-2 text-white transition-colors hover:text-primary-400">
              <Phone className="h-[18px] w-[18px] text-primary-400" />
              <span className="font-bold not-italic">(31) 3511-2373</span>
            </a>
            <div className="flex items-center space-x-2 text-white/80">
              <MapPin className="h-[18px] w-[18px] text-primary-400" />
              <span className="md:hidden">Betim - MG</span>
              <span className="hidden md:inline">Av. Adutora Várzea das Flores, 477 - Betim, MG</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
            <div className="flex items-center space-x-2 text-white/80">
              <Clock className="h-[18px] w-[18px] text-primary-400" />
              <span className="hidden lg:inline">Funcionamento:</span>
              <span className="font-semibold">Ter-Sex: 16h-22h | Sáb-Dom: 08h-19h</span>
            </div>
            <div className="ml-2 hidden space-x-4 border-l border-white/15 pl-5 lg:flex">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="text-white/70 transition-colors hover:text-primary-400">
                <Facebook className="h-[18px] w-[18px]" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="text-white/70 transition-colors hover:text-primary-400">
                <Instagram className="h-[18px] w-[18px]" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="text-white/70 transition-colors hover:text-primary-400">
                <Youtube className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <a href="/" className="flex items-center">
              <img
                src="/brand/kib-logo.png"
                alt="Logo Kartódromo de Betim"
                className="h-12 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              />
            </a>

            <nav className="hidden items-center gap-4 font-race text-[11px] italic font-bold uppercase tracking-wide lg:flex xl:gap-6 xl:text-xs">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="relative py-1 text-white/80 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-primary-400 after:transition-transform after:duration-200 hover:text-white hover:after:scale-x-100"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <button
              className="p-1.5 text-white transition-colors hover:text-primary-400 focus:outline-none lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Alternar Menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {isMenuOpen && (
            <div id="mobile-navigation" className="border-t border-white/10 pb-6 pt-2 lg:hidden">
              <nav className="flex flex-col space-y-1 font-display text-2xl italic uppercase">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="border-b border-white/10 py-3 text-white transition-colors hover:text-primary-400"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
```

- [ ] **Step 2: Verificação manual**

Run: `npm run dev`

No navegador, abrir `http://localhost:3000/` e confirmar:
1. Barra superior escura com telefone, endereço, horário e redes sociais — os mesmos dados de antes, só com visual novo.
2. Header principal escuro, com logo, menu desktop com sublinhado verde ao passar o mouse.
3. Redimensionar para largura mobile (< 1024px): botão de menu aparece, abre/fecha corretamente, todos os 9 links do menu aparecem.
4. Clicar em cada link do menu mobile e confirmar que navega para a URL certa (mesmo que a página de destino ainda esteja no visual antigo — isso é esperado até as próximas fases).

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(site): restyle Header with dark motorsport theme, same real data and links"
```

---

### Task 7: Reescrita visual do `Footer`

**Files:**
- Modify: `src/components/Footer.tsx`

**Interfaces:**
- Produces: mesmo componente `Footer` exportado como default, sem props, mesma forma de importação usada pelas páginas existentes.

- [ ] **Step 1: Substituir o conteúdo de `src/components/Footer.tsx`**

```tsx
import { Phone, Mail, MapPin, Clock, Users as Facebook, Camera as Instagram, Video as Youtube } from 'lucide-react';

const quickLinks = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#servicos', label: 'Modalidades' },
  { href: '/#promocoes', label: 'Promoções' },
  { href: '/pista', label: 'A Pista' },
  { href: '/kart-locacao', label: 'Locação' },
  { href: '/campeonatos', label: 'Campeonatos' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/duvidas', label: 'Dúvidas' },
  { href: '/#contato', label: 'Contato' },
];

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-ink-900 py-16 text-white/70">
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 space-y-6 md:col-span-2">
            <img src="/brand/kib-logo.png" alt="Logo Kartódromo de Betim" className="h-10 w-auto" />
            <p className="max-w-md text-sm font-light leading-relaxed text-white/60">
              Pista homologada de 1.110 metros, kart de locação, campeonatos e estrutura para eventos em Betim.
            </p>
            <div className="flex space-x-3 pt-2">
              <a href="https://www.facebook.com/kartodromodebetim" target="_blank" rel="noopener noreferrer" aria-label="Facebook do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/kartodromobetim/" target="_blank" rel="noopener noreferrer" aria-label="Instagram do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.youtube.com/kartodromodebetim31" target="_blank" rel="noopener noreferrer" aria-label="YouTube do Kartódromo de Betim" className="flex h-10 w-10 items-center justify-center border border-white/15 bg-white/5 text-white/70 transition-all hover:border-primary-400 hover:text-primary-400">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-race text-sm italic font-bold uppercase tracking-wider text-white">Canais de Contato</h4>
            <div className="space-y-3 text-xs font-light">
              <div className="flex items-center space-x-2.5">
                <Mail className="h-4 w-4 flex-shrink-0 text-primary-400" />
                <a href="mailto:contato@kartodromodebetim.com.br" className="text-white/70 transition-colors hover:text-primary-400">
                  contato@kartodromodebetim.com.br
                </a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 flex-shrink-0 text-primary-400" />
                <a href="tel:+553135112373" className="text-white/70 transition-colors hover:text-primary-400">(31) 3511-2373</a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Phone className="h-4 w-4 flex-shrink-0 text-primary-400" />
                <a href="https://wa.me/5531998842898" target="_blank" rel="noopener noreferrer" className="text-white/70 transition-colors hover:text-primary-400">
                  (31) 99884-2898
                </a>
              </div>
              <div className="flex items-start space-x-2.5 text-white/70">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
                <span>Av. Adutora Várzea das Flores, 477 - Itacolomi, Betim - MG, 32672-586</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-race text-sm italic font-bold uppercase tracking-wider text-white">Horários da Pista</h4>
            <div className="flex items-start space-x-2.5 text-xs font-light text-white/70">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
              <div>
                <p className="font-semibold text-white">Terça a Sexta-feira</p>
                <p className="text-white/60">16h00 às 22h00</p>
                <p className="mt-2 font-semibold text-white">Sábado e Domingo</p>
                <p className="text-white/60">08h00 às 19h00</p>
                <p className="mt-2 font-semibold text-red-400">Segunda-feira</p>
                <p className="text-white/60">Fechado para manutenção</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 font-race text-xs italic font-bold uppercase tracking-wider">
            {quickLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-white/60 transition-colors hover:text-primary-400">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8 text-center text-xs font-light text-white/50">
          <p>© {new Date().getFullYear()} Kartódromo Internacional de Betim. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
```

- [ ] **Step 2: Verificação manual**

Run: `npm run dev` (se já não estiver rodando)

No navegador, em `http://localhost:3000/`, rolar até o fim da página e confirmar:
1. Rodapé escuro com logo, descrição, ícones sociais.
2. Coluna "Canais de Contato" com e-mail, telefone e WhatsApp corretos e clicáveis.
3. Coluna "Horários da Pista" com os 3 horários corretos.
4. Links rápidos no fim navegam para as URLs certas.
5. Ano do copyright é o ano atual.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat(site): restyle Footer with dark motorsport theme, same real data and links"
```

---

### Task 8: Checkpoint final da fase — regressão visual em todas as rotas existentes

**Files:** nenhum (task só de verificação).

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam, incluindo os 6 novos de `lib/animate-count.test.ts`.

- [ ] **Step 2: Rodar o typecheck completo**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Verificação visual manual de todas as rotas públicas existentes**

Com `npm run dev` rodando, abrir cada uma destas rotas e confirmar que a página carrega sem erro no console e mostra o novo Header/Footer escuros (o corpo de cada página ainda está no visual antigo — só será restilizado nas próximas fases):

- `/`
- `/historia`
- `/duvidas`
- `/eventos`
- `/pista`
- `/kart-locacao`
- `/reservas`
- `/campeonatos`
- `/campeonatos/kac`

- [ ] **Step 4: Confirmar que admin e telão não foram afetados**

Abrir `/admin/login` e `/telao` (ou a rota de telão configurada) e confirmar visualmente que nada mudou nesses dois.

- [ ] **Step 5: Commit final da fase (se houver qualquer ajuste feito durante a verificação)**

```bash
git add -A
git commit -m "chore(site): phase 1 visual foundation checkpoint"
```

(Só rodar este commit se `git status` mostrar alguma alteração pendente; se não houver nada, pular este passo.)

---

## Self-review desta fase

- **Cobertura da spec:** tokens de cor/fonte (Task 1, 3), componentes reutilizáveis citados na spec — `SectionHeading`/`eyebrow+título`, `StatCounter`, `PosterCard`, `GlassPanel`, `Ticker` (Tasks 4-5) — e Header/Footer novos (Tasks 6-7) estão todos cobertos. `AccordionFAQ` e `TrackMap`, também citados na spec, ficam para a Fase 3 (Dúvidas e Pista), onde serão de fato usados — incluí-los aqui seria código morto sem consumidor.
- **Sem placeholders:** todo passo tem código completo, sem "TBD"/"depois eu implemento".
- **Consistência de tipos:** `getCountUpValue(elapsedMs, durationMs, target)` tem a mesma assinatura na Task 2 (implementação/teste) e na Task 4 (uso dentro de `StatCounter`).
- **Escopo:** esta fase entrega uma base visual testável e revisável isoladamente (fontes carregando, cores disponíveis, Header/Footer novos no ar em todas as rotas), sem depender de nenhuma fase futura — bate com a exigência de "cada fase produz software funcionando e testável por si só".
