import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noite: v('bg'),
        lona: v('surface'),
        palco: v('line'),
        luar: v('ink'),
        nevoa: v('muted'),
        sol: v('primary'),
        chita: v('accent'),
        mandacaru: v('success'),
      },
      fontFamily: {
        display: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
        body: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
      },
      borderRadius: { capa: '14px' },
    },
  },
  plugins: [],
};
export default config;
