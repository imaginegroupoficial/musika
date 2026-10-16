import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noite: '#1A1240',
        lona: '#241A57',
        palco: '#30237A',
        sol: '#FFC531',
        chita: '#E8336D',
        mandacaru: '#2BB673',
        luar: '#F3EEFF',
        nevoa: '#B9AEE0',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"Figtree"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { capa: '14px' },
    },
  },
  plugins: [],
};
export default config;
