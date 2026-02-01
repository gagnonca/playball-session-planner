/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soccer/sports theme with dark mode support
        field: {
          light: '#8BC34A',
          DEFAULT: '#4CAF50',
          dark: '#2E7D32',
        },
        accent: {
          light: '#64B5F6',
          DEFAULT: '#2196F3',
          dark: '#1976D2',
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
