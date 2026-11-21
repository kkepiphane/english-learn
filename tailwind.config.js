/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef6ff', 100: '#d9eaff', 200: '#bcdaff', 300: '#8ec2ff', 400: '#599fff', 500: '#337bff', 600: '#1b5cf5', 700: '#1447e1', 800: '#173bb6', 900: '#19378f' },
        ink: { 50: '#f7f8fa', 100: '#eef0f4', 200: '#dde1e8', 300: '#c2c8d3', 400: '#8d96a8', 500: '#5f6a80', 600: '#465066', 700: '#353d50', 800: '#22283a', 900: '#151a28', 950: '#0d111c' },
      },
    },
  },
  plugins: [],
}
