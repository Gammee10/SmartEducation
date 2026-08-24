/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        // Subtle layered elevation used by cards across the app.
        card:
          '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        'card-hover':
          '0 4px 6px -2px rgb(16 24 40 / 0.05), 0 12px 20px -4px rgb(16 24 40 / 0.10)',
        // Floating menus / popovers.
        dropdown:
          '0 4px 6px -2px rgb(16 24 40 / 0.05), 0 16px 28px -6px rgb(16 24 40 / 0.18)',
        // Elevated hero / feature surfaces.
        glow: '0 0 0 1px rgb(37 99 235 / 0.08), 0 8px 24px -6px rgb(37 99 235 / 0.25)',
        sidebar: '1px 0 0 0 rgb(16 24 40 / 0.06)',
      },
      backgroundImage: {
        // Brand gradient used for heroes, sidebars accents and CTAs.
        'brand': 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
        'brand-soft': 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
      },
    },
  },
  plugins: [],
};
