import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {
      maxWidth: {
        profile: '600px',
      },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        fg: {
          DEFAULT: '#1a1a1a',
          muted: '#6b7280',
          light: '#9ca3af',
        },
        bg: {
          DEFAULT: '#ffffff',
          subtle: '#f9fafb',
        },
        accent: '#2563eb',
        verified: '#16a34a',
      },
    },
  },
  plugins: [],
};

export default config;
