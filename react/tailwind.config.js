/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // NOTE: Tailwind v4 recommends using @source inline() in your CSS
  // to safelist classes that are generated dynamically. Regex-based
  // safelisting in the config (JIT-era) is not supported in the same way.
  // We intentionally keep the config minimal and rely on `@source inline`
  // (see `src/reference.css`) so @apply and dynamic classes are generated.
  theme: {
    extend: {
      colors: {
        // App-specific palette (defaults from the Figma make approximated)
        app: {
          primary: '#060614', // near-black primary used for CTA
          'primary-contrast': '#ffffff',
          bg: '#f9fafb',
          surface: '#ffffff',
          muted: '#6b7280',
          accent: '#f97316'
        },
        primary: {
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
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}