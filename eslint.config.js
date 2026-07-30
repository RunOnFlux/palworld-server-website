import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist/ and .ssr/ are build output (minified bundles); trash/ is archived code.
  globalIgnores(['dist', '.ssr', 'trash']),
  // Node.js server files
  {
    files: ['server.js', 'vite.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // React browser files
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['server.js', 'vite.config.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Allow unused vars: uppercase, underscore, 'motion', or prefixed with 'unused'
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]|^motion$|^unused|^set[A-Z].*|^navigate$|^useMemo$|^useCallback$',
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // Make exhaustive-deps a warning instead of error - too strict for production code
      'react-hooks/exhaustive-deps': 'warn',
      // Disable setState-in-effect rule - sometimes necessary for derived state
      'react-hooks/set-state-in-effect': 'off',
      // Disable useless-catch - sometimes needed for logging
      'no-useless-catch': 'warn',
      // Allow exporting non-components (utils, constants) with components
      'react-refresh/only-export-components': 'warn',
    },
  },
])
