/** @type {import("eslint").Linter.Config} */
export default {
  root: true,
  extends: ['@repo/eslint-config/base'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
};
