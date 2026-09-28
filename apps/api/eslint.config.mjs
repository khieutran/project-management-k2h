import globals from 'globals';
import baseConfig from '@project-management/config/eslint/base';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts', 'test/**/*.ts', '*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];