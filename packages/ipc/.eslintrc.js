/** @type {import("eslint").Linter.Config} */
export default {
  root: true,
  extends: ['@repo/eslint-config/base'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  ignorePatterns: ['**/dist/**', '**/node_modules/**', '**/*.md'],
};
