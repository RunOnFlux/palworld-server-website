/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2196F3',
          hover: '#1976D2',
          light: '#42A5F5',
          dark: '#1565C0',
        },
        secondary: {
          DEFAULT: '#FF9800',
          hover: '#F57C00',
          light: '#FFB74D',
        },
        accent: {
          DEFAULT: '#4CAF50',
          hover: '#388E3C',
        },
        background: {
          DEFAULT: '#0a0a0a',
          alt: '#1a1a1a',
        },
        surface: {
          DEFAULT: '#1f1f1f',
          hover: '#2a2a2a',
        },
        border: {
          DEFAULT: '#2a2a0a',
          light: '#404040',
        },
        text: {
          DEFAULT: '#ffffff',
          secondary: '#a0a0a0',
          muted: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
