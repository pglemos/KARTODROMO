// Cores `kib-*`: apelidos das variáveis --kib-cor-* geradas de tokens/kib.tokens.json (styles/tokens.css).
// Seguem o tema do trecho (data-tema="claro" | "escuro"); `/20` etc. vira color-mix com transparente.
const corToken = (variavel) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === '1'
    ? `var(--kib-cor-${variavel})`
    : `color-mix(in srgb, var(--kib-cor-${variavel}) calc(${opacityValue} * 100%), transparent)`;

const kib = {
  fundo: corToken('fundo-app'),
  superficie: corToken('superficie-padrao'),
  suave: corToken('superficie-suave'),
  campo: corToken('superficie-campo'),
  borda: corToken('borda-sutil'),
  'borda-forte': corToken('borda-forte'),
  'borda-campo': corToken('borda-campo'),
  texto: corToken('texto-principal'),
  'texto-2': corToken('texto-secundario'),
  'texto-3': corToken('texto-terciario'),
  acao: corToken('acao-principal'),
  'acao-forte': corToken('acao-principal-pressionado'),
  'sobre-acao': corToken('acao-sobre-principal'),
  sucesso: corToken('estado-sucesso-texto'),
  'sucesso-solido': corToken('estado-sucesso-solido'),
  'sucesso-fundo': corToken('estado-sucesso-fundo'),
  perigo: corToken('estado-perigo-texto'),
  'perigo-solido': corToken('estado-perigo-solido'),
  'perigo-fundo': corToken('estado-perigo-fundo'),
  aviso: corToken('estado-aviso-texto'),
  'aviso-solido': corToken('estado-aviso-solido'),
  'aviso-fundo': corToken('estado-aviso-fundo'),
  info: corToken('estado-info-texto'),
  'info-solido': corToken('estado-info-solido'),
  'info-fundo': corToken('estado-info-fundo'),
  roxo: corToken('dominio-melhor-volta'),
  inverso: corToken('texto-inverso'),
  sobreposicao: corToken('sobreposicao'),
};

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
        kib,
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
