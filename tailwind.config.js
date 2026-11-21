/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Violet: the main brand colour (actions, current step, progress).
        brand: { 50: '#f5f3ff', 100: '#ede8ff', 200: '#dcd3ff', 300: '#c1b0ff', 400: '#a083ff', 500: '#8257fb', 600: '#6d38ef', 700: '#5d27d6', 800: '#4d21ad', 900: '#3f1e8a', 950: '#260f5c' },
        // Warm orange: streak, rewards, XP.
        flame: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
        ink: { 50: '#f8f7fb', 100: '#efedf5', 200: '#dfdbe9', 300: '#c4bfd3', 400: '#8f89a3', 500: '#625c78', 600: '#4a4560', 700: '#37334a', 800: '#252236', 900: '#181626', 950: '#0f0d1a' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        wiggle: { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-8deg)' }, '75%': { transform: 'rotate(8deg)' } },
        pulsering: { '0%': { boxShadow: '0 0 0 0 rgba(130,87,251,.45)' }, '100%': { boxShadow: '0 0 0 14px rgba(130,87,251,0)' } },
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.2) both',
        rise: 'rise .4s ease-out both',
        wiggle: 'wiggle .6s ease-in-out 2',
        pulsering: 'pulsering 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
}
