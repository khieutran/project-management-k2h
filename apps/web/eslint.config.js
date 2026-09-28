import baseConfig from '@project-management/config/eslint/base'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const reactFiles = ['**/*.{ts,tsx}']

export default [
  ...baseConfig,
  {
    files: reactFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: reactFiles,
  },
  {
    ...reactRefresh.configs.vite,
    files: reactFiles,
  },
]