import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Note: eslint-plugin-jsx-a11y and eslint-plugin-react do not yet declare
// support for ESLint 10, so accessibility rules are not linted automatically.
// Re-add them here once they ship an ESLint 10 peer range.

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'release/**'],
  },
  js.configs.recommended,

  // Electron main process + the COM bridge: Node, no DOM.
  {
    files: ['main.js', 'preload.js', 'corel-bridge.mjs', 'eslint.config.mjs', 'vite.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    files: ['corel-bridge.mjs', 'eslint.config.mjs', 'vite.config.mjs'],
    languageOptions: { sourceType: 'module' },
  },

  // Shared pure helpers and their tests run under Node.
  {
    files: ['src/lib/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // Renderer: browser globals, JSX, React hooks rules.
  {
    files: ['src/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Rules that apply everywhere.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.jsx'],
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
];
