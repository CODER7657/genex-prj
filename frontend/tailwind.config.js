/** @type {import('tailwindcss').Config} */
// Clay Style: the theme is replaced (not extended) with the tokens in tokens.css, so the
// stock purple/pink/blue/gray palette, thin weights and fixed font sizes cannot be used.
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      mint: 'var(--mint)',
      coral: 'var(--coral)',
      leaf: 'var(--leaf)',
      sand: 'var(--sand)',
      clay: 'var(--clay)',
      white: 'var(--white)',
      ink: 'var(--ink)',
      'ink-soft': 'var(--ink-soft)',
    },
    fontFamily: {
      sans: ['var(--font-sans)'],
    },
    fontSize: {
      sm: ['var(--fs-sm)', { lineHeight: '1.45' }],
      base: ['var(--fs-base)', { lineHeight: '1.55' }],
      lg: ['var(--fs-lg)', { lineHeight: '1.45' }],
      xl: ['var(--fs-xl)', { lineHeight: '1.3' }],
      '2xl': ['var(--fs-2xl)', { lineHeight: '1.2' }],
      '3xl': ['var(--fs-3xl)', { lineHeight: '1.15' }],
      hero: ['var(--fs-hero)', { lineHeight: '1.08' }],
    },
    fontWeight: {
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    extend: {
      borderRadius: {
        clay: 'var(--radius-md)',
        'clay-lg': 'var(--radius-lg)',
        'clay-xl': 'var(--radius-xl)',
      },
      boxShadow: {
        clay: 'var(--shadow-clay)',
        'clay-sm': 'var(--shadow-clay-sm)',
        'clay-pressed': 'var(--shadow-clay-pressed)',
        well: 'var(--shadow-well)',
      },
    },
  },
  plugins: [],
};
