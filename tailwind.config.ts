import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f6f7f9',
        surface: '#fff',
        ink: '#171923',
        muted: '#858b98',
        line: '#eceef2',
        purple: '#7255d9',
        'purple-soft': '#f0edff',
        green: '#16865b',
        'green-soft': '#e9f7f0',
        red: '#d65c62',
        'red-soft': '#fff0f0',
        amber: '#b87922',
        'amber-soft': '#fff6e8',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        'xl': '18px',
        '2xl': '20px',
      },
      boxShadow: {
        'card': '0 8px 28px rgba(28,31,43,.045)',
        'purple': '0 4px 12px #7255d926',
      },
      animation: {
        'pg': 'pg .28s cubic-bezier(.2,.8,.2,1)',
        'pop': 'pop .24s cubic-bezier(.2,.8,.2,1)',
        'fade': 'fade .18s',
        'slideIn': 'slideIn .6s cubic-bezier(.2,.8,.2,1)',
        'pulse': 'pulse 2s infinite',
        'fu': 'fu 1s',
        'fd': 'fd 1s',
      },
      keyframes: {
        pg: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { from: { opacity: '0', transform: 'scale(.96) translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(-14px)', background: '#efe9ff' }, to: { opacity: '1', transform: 'none' } },
        pulse: { '50%': { boxShadow: '0 0 0 5px #79d6ad33' } },
        fu: { '30%': { color: '#79d6ad' } },
        fd: { '30%': { color: '#ff9aa0' } },
      },
    },
  },
  plugins: [],
}
export default config
