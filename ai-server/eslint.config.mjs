import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Deliberate no-op catch blocks are used throughout for "best effort"
      // cleanup; an empty block with a comment in it is fine.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Express error middleware must keep its 4-arity signature even when the
      // last parameter is unused, hence the leading-underscore escape hatch.
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
