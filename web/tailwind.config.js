/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          red: '#FF3B5C',
          blue: '#0066FF',
          orange: '#FF9500',
          green: '#34C759',
          purple: '#AF52DE',
          gray: '#8E8E93',
        },
        ink: {
          primary: '#1D1D1F',
          secondary: '#6E6E73',
          tertiary: '#AEAEB2',
        },
        surface: {
          page: '#F5F5F7',
          card: '#FFFFFF',
          hover: '#F0F0F5',
          border: '#E5E5EA',
        },
        stage: {
          new: '#0066FF',
          contacted: '#FF9500',
          interested: '#AF52DE',
          negotiating: '#FF3B5C',
          won: '#34C759',
          lost: '#8E8E93',
        },
      },
      fontFamily: {
        sans: ['"SF Pro Display"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.12)',
        modal: '0 32px 64px rgba(0,0,0,0.2)',
        button: '0 4px 12px rgba(0,102,255,0.3)',
        'button-red': '0 4px 12px rgba(255,59,92,0.3)',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
        '3xl': '32px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        'slide-down': {
          '0%': { opacity: 0, transform: 'translateY(-12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
        'press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.98)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 320ms cubic-bezier(0.25,0.46,0.45,0.94)',
        'slide-up': 'slide-up 320ms cubic-bezier(0.25,0.46,0.45,0.94)',
        'scale-in': 'scale-in 220ms cubic-bezier(0.25,0.46,0.45,0.94)',
        'slide-down': 'slide-down 220ms cubic-bezier(0.25,0.46,0.45,0.94)',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'press': 'press 150ms ease',
      },
    },
  },
  plugins: [],
};
