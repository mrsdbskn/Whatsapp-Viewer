/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        oled: {
          950: '#080E13',
          900: '#0B141A', // Deep OLED slate canvas
          850: '#111B21', // Secondary background canvas
          800: '#182229', // Elevated panel & sidebar
          750: '#202C33', // Elevated surface & received bubble
          700: '#222E35', // Subtle borders
          600: '#2A3942', // Hover state
        },
        wa: {
          emerald: '#00A884', // Primary WhatsApp emerald accent
          emeraldHover: '#06CF9C',
          emeraldDark: '#005C4B', // Outbound bubble sent
          emeraldLight: '#25D366',
        },
        ai: {
          violet: '#8B5CF6', // AI Violet accent
          violetLight: '#A78BFA',
          violetDark: '#6D28D9',
          violetGlow: 'rgba(139, 92, 246, 0.15)',
        },
        bubble: {
          sent: '#005C4B',
          received: '#202C33',
        },
        waText: {
          primary: '#E9EDEF',
          secondary: '#8696A0',
          muted: '#667781',
          accent: '#53BDEB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'oled': '0 4px 20px -2px rgba(0, 0, 0, 0.6)',
        'bubble': '0 1px 0.5px rgba(11, 20, 26, 0.13)',
        'ai-glow': '0 0 25px rgba(139, 92, 246, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        }
      }
    },
  },
  plugins: [],
}
