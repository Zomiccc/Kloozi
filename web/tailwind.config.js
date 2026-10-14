/** @type {import('tailwindcss').Config} */
/* FLAZYN DESIGN SYSTEM — SOFT CLAY
   Light canvas, white floating cards, violet brand, pastel helpers,
   amber for urgency (no red, no dark surfaces). Mirrors src/index.css. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: '#FAFAF9', alt: '#F5F5F4', raised: '#FFFFFF' },
        surface: { page: '#FAFAF9', alt: '#F5F5F4', card: '#FFFFFF', border: '#E7E5E4' },
        ink: { DEFAULT: '#1C1917', primary: '#1C1917', secondary: '#57534E', tertiary: '#A8A29E' },
        hairline: { DEFAULT: '#E7E5E4', strong: '#D6D3D1' },
        brand: { DEFAULT: '#5B3DF5', light: '#7C5CFF', deep: '#4A2FD6', soft: '#F3F0FF' },
        accent: { DEFAULT: '#EDE9FF', deep: '#4A2FD6', hover: '#DDD6FE', orange: '#F59E0B' },
        ember: { DEFAULT: '#F59E0B', soft: '#FFE9C7', deep: '#B45309' },
        peach: { DEFAULT: '#FFE8D2', deep: '#B45309' },
        mint: { DEFAULT: '#D5F5E8', deep: '#0E8A5F' },
        butter: { DEFAULT: '#FFF1C2', deep: '#8A6100' },
        coral: { DEFAULT: '#FFE9C7', deep: '#B45309' },
        sky: { DEFAULT: '#DCE8FF', deep: '#2F6FDB' },
        semantic: {
          success: '#D5F5E8', 'success-deep': '#0E8A5F',
          warning: '#FFF1C2', 'warning-deep': '#8A6100',
          danger: '#FFE9C7', 'danger-deep': '#B45309',
          info: '#DCE8FF', 'info-deep': '#2F6FDB',
        },
        stage: {
          new: '#DCE8FF', contacted: '#F3F0FF', interested: '#D5F5E8',
          negotiating: '#FFF1C2', won: '#C9F2DF', lost: '#F5F5F4',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['"Inter"', '-apple-system', 'sans-serif'],
        mono: ['"Inter"', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        display: ['56px', { lineHeight: '1.02', fontWeight: '400', letterSpacing: '-0.02em' }],
        h1: ['34px', { lineHeight: '1.1', fontWeight: '400' }],
        h2: ['17px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.55', fontWeight: '450' }],
        'body-sm': ['13px', { lineHeight: '1.5', fontWeight: '450' }],
        label: ['10.5px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.09em' }],
        meta: ['10.5px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.09em' }],
        'mono-data': ['12.5px', { lineHeight: '1.5', fontWeight: '450' }],
      },
      /* ── Section 3: spacing scale ── */
      spacing: {
        micro: '4px',
        tight: '8px',
        default: '12px',
        gap: '16px',
        section: '24px',
        block: '32px',
        major: '48px',
        page: '64px',
        rail: '68px',
        topbar: '64px',
      },
      /* ── Section 4: corner radius ── */
      borderRadius: {
        btn: '12px',
        input: '12px',
        card: '20px',
        row: '14px',
        modal: '22px',
        tile: '14px',
        pill: '999px',
        icon: '12px',
        tooltip: '6px',
        /* legacy aliases remapped to the soft scale */
        sharp: '12px',
        dropdown: '16px',
      },
      /* ── Section 5: shadows ── */
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,0.04), 0 8px 24px -14px rgba(28,25,23,0.18)',
        'card-hover': '0 2px 4px rgba(28,25,23,0.05), 0 18px 40px -16px rgba(28,25,23,0.32)',
        dropdown: '0 0 0 1px rgba(28,25,23,0.06), 0 22px 48px -18px rgba(28,25,23,0.35)',
        modal: '0 0 0 1px rgba(28,25,23,0.05), 0 40px 90px -30px rgba(28,25,23,0.45)',
        focus: '0 0 0 4px rgba(91,61,245,0.18)',
      },
      backgroundImage: {
        'hero-stat': 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)',
      },
      keyframes: {
        'slide-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: 0, transform: 'scale(0.94)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        'slide-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'accent-pulse': { '0%': { background: 'rgba(91,61,245,0.18)' }, '100%': { background: 'transparent' } },
      },
      animation: {
        'slide-up': 'slide-up 220ms cubic-bezier(0.22,1,0.36,1)',
        'scale-in': 'scale-in 220ms cubic-bezier(0.22,1,0.36,1)',
        'slide-right': 'slide-right 250ms cubic-bezier(0.22,1,0.36,1)',
        shimmer: 'shimmer 1.6s linear infinite',
        'accent-pulse': 'accent-pulse 300ms ease-out',
      },
      maxWidth: { read: '640px' },
    },
  },
  plugins: [],
};
