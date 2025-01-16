import { config as reactInternalConfig } from '@repo/eslint-config/react-internal';
import tseslint from 'typescript-eslint';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  ...reactInternalConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript rules - More lenient during transition
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          allowFunctionsWithoutTypeParameters: true,
          allowedNames: [
            'render',
            'getInitialProps',
            'getStaticProps',
            'getServerSideProps',
            'component',
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          destructuredArrayIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],

      // React rules
      'react/prop-types': 'off', // We use TypeScript for prop validation
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unknown-property': [
        'error',
        {
          ignore: ['cmdk-input-wrapper'],
        },
      ],

      // General rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'no-case-declarations': 'off',
      'no-undef': 'off', // TypeScript handles this
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: [
      '*.js',
      '*.mjs',
      '*.cjs',
      '*.config.js',
      '*.config.mjs',
      'vite.config.*',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-undef': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/dist-electron/**',
      '**/node_modules/**',
      '**/*.md',
      '**/build/**',
    ],
  },
];
