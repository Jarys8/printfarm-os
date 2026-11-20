/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--bg)',
        panel: 'var(--card)',
        raised: 'var(--subtle)',
        line: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        maker: {
          DEFAULT: '#F97316',
          soft: 'rgba(249,115,22,0.14)',
          deep: '#C2410C',
        },
        telemetry: {
          DEFAULT: '#06B6D4',
          soft: 'rgba(6,182,212,0.14)',
        },
        ok: '#10B981',
        warn: '#F59E0B',
        bad: '#EF4444',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 30px -18px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateY(-8px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        pulseglow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
        'slide-in': 'slide-in 180ms ease-out both',
        pulseglow: 'pulseglow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
