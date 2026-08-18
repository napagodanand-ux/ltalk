/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--lt-primary)',
          light: 'var(--lt-primary-light)',
          dark: 'var(--lt-primary-dark)',
          hover: 'var(--lt-primary-hover)',
          active: 'var(--lt-primary-active)'
        },
        bg: {
          DEFAULT: 'var(--lt-bg)',
          secondary: 'var(--lt-bg-secondary)',
          tertiary: 'var(--lt-bg-tertiary)'
        },
        surface: {
          DEFAULT: 'var(--lt-surface)',
          hover: 'var(--lt-surface-hover)'
        },
        content: {
          DEFAULT: 'var(--lt-text)',
          secondary: 'var(--lt-text-secondary)',
          muted: 'var(--lt-text-muted)'
        },
        edge: 'var(--lt-border)',
        success: 'var(--lt-success)',
        online: 'var(--lt-online)'
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif']
      },
      boxShadow: {
        panel: '0 1px 3px var(--lt-shadow)'
      },
      fontSize: {
        meta: '12px'
      }
    }
  },
  plugins: []
};
