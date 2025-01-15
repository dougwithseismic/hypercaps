/** @type {import("eslint").Linter.Config} */
export default {
  root: true,
  extends: ['@repo/eslint-config/react-internal'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json'],
  },
};
