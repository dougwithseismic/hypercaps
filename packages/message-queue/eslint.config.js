import baseConfig from '@repo/eslint-config/base';
import tseslint from 'typescript-eslint';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  ...baseConfig,
  {
    rules: {
      'no-console': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-case-declarations': 'off',
      'no-cond-assign': ['error', 'except-parens'],
      'no-func-assign': 'off',
      'no-undef': 'off',
      'no-useless-escape': 'warn',
    },
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.md'],
  },
];
