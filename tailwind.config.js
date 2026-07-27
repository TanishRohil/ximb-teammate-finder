/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "ink" now doubles as the dark cork/header tone
        ink: {
          DEFAULT: '#241A12',
          light: '#3A2A1C',
        },
        // "manila" now doubles as the corkboard tone; -light is the
        // cream index-card color everything sits on top of
        manila: {
          DEFAULT: '#B08B5A',
          light: '#FFF9EC',
          dark: '#8C6A3F',
        },
        charcoal: '#241A12',
        // "stamp" now doubles as the pin/thread red
        stamp: {
          DEFAULT: '#C1272D',
          light: '#E14B41',
        },
        sage: {
          DEFAULT: '#5F7A52',
          light: '#7C9A6C',
        },
      },
      fontFamily: {
        display: ['"Courier Prime"', 'monospace'],
        hand: ['"Caveat"', 'cursive'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
      backgroundImage: {
        'paper-texture':
          "radial-gradient(circle at 1px 1px, rgba(43,43,40,0.06) 1px, transparent 0)",
      },
      backgroundSize: {
        paper: '18px 18px',
      },
      keyframes: {
        'card-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) rotate(var(--r, -2deg))' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(var(--r, -2deg))' },
        },
        wobble: {
          '0%, 100%': { transform: 'translateX(-50%) rotate(0deg)' },
          '50%': { transform: 'translateX(-50%) rotate(14deg)' },
        },
      },
      animation: {
        'card-in': 'card-in .5s ease backwards',
      },
    },
  },
  plugins: [],
}
