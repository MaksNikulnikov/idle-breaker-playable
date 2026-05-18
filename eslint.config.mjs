import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const cocosFreeLayers = ['assets/scripts/domain/**/*.ts', 'assets/scripts/application/**/*.ts'];

export default tseslint.config(
  {
    ignores: [
      'build/**',
      'dist/**',
      'library/**',
      'temp/**',
      'node_modules/**',
      'assets/art/**',
      'assets/**/*.meta',
      'assets/**/*.scene',
      'assets/**/*.prefab',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['assets/scripts/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      'prefer-const': 'warn',
    },
  },
  {
    files: cocosFreeLayers,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'cc',
              message:
                'Cocos APIs belong in scene-facing components/adapters. Keep this layer engine-independent.',
            },
          ],
          patterns: [
            {
              group: ['cc/*'],
              message:
                'Cocos APIs belong in scene-facing components/adapters. Keep this layer engine-independent.',
            },
          ],
        },
      ],
    },
  },
);
