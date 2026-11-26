/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Ocean teal: the main brand colour (actions, current step, progress).
        brand: { 50: '#effcfa', 100: '#d3f5ef', 200: '#a9eadf', 300: '#71d6c8', 400: '#3dbaac', 500: '#1f9d91', 600: '#0f7f76', 700: '#0f6660', 800: '#11524e', 900: '#124442', 950: '#032826' },
        // Coral: calls to action, streak, rewards, XP.
        flame: { 50: '#fff4f1', 100: '#ffe5de', 200: '#ffcabd', 300: '#ffa592', 400: '#fb8068', 500: '#f4614a', 600: '#e0452f', 700: '#bc3524', 800: '#9a2f22', 900: '#7f2b21' },
        // Sun: completed lessons and achievements.
        sun: { 100: '#fef3c7', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 900: '#78350f' },
        // Warm sand neutrals.
        ink: { 50: '#fbf8f3', 100: '#f3eee6', 200: '#e7e0d4', 300: '#d2c8b8', 400: '#9d9485', 500: '#6f685d', 600: '#554f46', 700: '#3e3a34', 800: '#2a2824', 900: '#1d1c19', 950: '#131210' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'none', opacity: '1' } },
        wiggle: { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-8deg)' }, '75%': { transform: 'rotate(8deg)' } },
        pulsering: { '0%': { boxShadow: '0 0 0 0 rgba(31,157,145,.45)' }, '100%': { boxShadow: '0 0 0 14px rgba(31,157,145,0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        flicker: { '0%,100%': { transform: 'scale(1) rotate(0)' }, '30%': { transform: 'scale(1.12) rotate(-4deg)' }, '60%': { transform: 'scale(.96) rotate(3deg)' } },
        zoomin: { '0%': { transform: 'scale(.3) rotate(-12deg)', opacity: '0' }, '70%': { transform: 'scale(1.15) rotate(4deg)', opacity: '1' }, '100%': { transform: 'scale(1) rotate(0)' } },
        fadein: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.2) both',
        rise: 'rise .4s ease-out both',
        wiggle: 'wiggle .6s ease-in-out 2',
        pulsering: 'pulsering 1.6s ease-out infinite',
        float: 'float 6s ease-in-out infinite',
        flicker: 'flicker 1.8s ease-in-out infinite',
        zoomin: 'zoomin .7s cubic-bezier(.2,.9,.3,1.2) both',
        fadein: 'fadein .25s ease-out both',
      },
    },
  },
  plugins: [],
}
