export default [
  {
    ignores: ['backend/**', 'server/**', '**/node_modules/**', 'backend/node_modules/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {},
  },
];
