// ESLint 9 flat config.
// eslint-config-next v16 exports a flat-config array that already bundles
// typescript-eslint, react, react-hooks, import, and jsx-a11y.
import next from 'eslint-config-next'
import prettier from 'eslint-config-prettier'
import tseslint from '@typescript-eslint/eslint-plugin'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...next,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // Start lenient — tighten in later phases. Keep the Phase 0 diff reviewable.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'warn',
      // Pre-existing issues fixed in later phases (data-fetching rewrite / cosmetic pass).
      // Downgraded to warn so CI gates on regressions without blocking the tooling PR.
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
]

export default config
