/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effdf4',
          100: '#d9f9e3',
          200: '#b3f1c9',
          300: '#75e4a3',
          400: '#36cd78',
          500: '#029048',
          600: '#027940',
          700: '#016035',
          800: '#014824',
          900: '#003319',
          950: '#001c0e',
        },
        cream: {
          50: '#FCFAF3',
          100: '#FAF6ED',
          200: '#F5EFE0',
          300: '#EFE7D2',
          400: '#E5D9B8',
          500: '#D4C596',
        },
        cinema: {
          900: '#051910',
          800: '#0a2818',
          700: '#0d3320',
          600: '#134526',
          500: '#1a5a32',
        },
        ink: {
          900: '#0f1a14',
          800: '#1a2e22',
          700: '#2a4538',
          600: '#4a5d52',
          500: '#7a8a80',
        }
      },
      fontFamily: {
        sans: ['IRANSans', 'Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
        display: ['IRANSans', 'Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(2, 144, 72, 0.08)',
        'glass-hover': '0 12px 40px rgba(2, 144, 72, 0.15)',
        'brand': '0 4px 16px rgba(2, 144, 72, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
};
