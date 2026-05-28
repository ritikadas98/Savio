import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Phase D D.10/D.13 — Edge Functions are Deno runtime and can't import
  // from src/lib/dates.ts; the DEMO_TODAY ban only makes sense for src/**
  // code. supabase/functions/** is fully ignored; lint rules don't apply
  // to that directory (Deno tooling has its own checks).
  { ignores: ['dist', 'supabase/functions/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Phase D D.13 — selector refined to flag only the zero-arg form
      // `new Date()`, which is the "use system clock" anti-pattern this rule
      // is meant to ban. `new Date(string)` (parsing) and `new Date(y, m, d)`
      // (component construction) are legitimate; the original selector
      // flagged all `new Date(...)` and produced false positives in helpers
      // like daysInMonth() and formatDateLong().
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Do not use 'new Date()'. Use helpers from 'src/lib/dates.ts' instead (e.g. today())."
        }
      ]
    },
  },
  {
    files: ['src/lib/dates.ts'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  }
)
