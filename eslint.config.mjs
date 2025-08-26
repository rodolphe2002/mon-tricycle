export default [
  {
    ignores: [
      'backend/**',
      'server/**',
      '**/node_modules/**',
      'backend/node_modules/**',
      '.next/**',
      '**/.next/**',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
      }
    },
    plugins: {
      'react-hooks': (await import('eslint-plugin-react-hooks')).default,
      '@next/next': (await import('@next/eslint-plugin-next')).default,
    },
    rules: {
      // No opinionated rules for now; plugins are registered so inline disable comments won't error
    },
  },
];
