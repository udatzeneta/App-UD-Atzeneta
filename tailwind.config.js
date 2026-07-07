/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: {
            50: '#fff1f2',
            100: '#ffe4e6',
            200: '#fecdd3',
            300: '#fda4af',
            400: '#fb7185',
            505: '#f43f5e',
            600: '#C1121F', // UD Atzeneta Official Red
            700: '#9E0F18',
            800: '#7F1118',
            900: '#671419',
            950: '#3c0609',
          },
          black: {
            DEFAULT: '#111111',
            card: '#161616',
            hover: '#1d1d1d',
            border: '#242424',
            bg: '#0b0b0b',
          },
          white: '#ffffff',
          gray: {
            light: '#f5f5f5',
            muted: '#a3a3a3',
            dark: '#525252',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-red': '0 0 15px rgba(193, 18, 31, 0.15)',
        'premium': '0 4px 30px rgba(0, 0, 0, 0.4)',
        'border-glow': '0 0 0 1px rgba(255, 255, 255, 0.05), 0 1px 3px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'accordion-down': 'accordionDown 0.2s ease-out',
        'accordion-up': 'accordionUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      }
    },
  },
  plugins: [],
}
