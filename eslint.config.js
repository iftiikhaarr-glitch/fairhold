import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Replit installs editor/Agent templates here; they are not app source.
  globalIgnores(['dist', '.local/**', '.cache/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      // shadcn components intentionally export their shared variants/hooks.
      'react-refresh/only-export-components': ['error', {
        allowExportNames: ['badgeVariants', 'buttonVariants', 'buttonGroupVariants', 'useFormField', 'navigationMenuTriggerStyle', 'useSidebar', 'toggleVariants'],
      }],
    },
  },
])
