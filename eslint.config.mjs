import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      obsidianmd,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      ...obsidianmd.configs.recommended,
      'obsidianmd/ui/sentence-case': ['error', { enforceCamelCaseLower: true, brands: ['iOS', 'iPadOS', 'macOS', 'Windows', 'Android', 'Linux', 'Obsidian', 'Obsidian Sync', 'Obsidian Publish', 'Google Drive', 'Dropbox', 'OneDrive', 'iCloud Drive', 'YouTube', 'Slack', 'Discord', 'Telegram', 'WhatsApp', 'Twitter', 'X', 'Readwise', 'Zotero', 'Excalidraw', 'Mermaid', 'Markdown', 'LaTeX', 'JavaScript', 'TypeScript', 'Node.js', 'npm', 'pnpm', 'Yarn', 'Git', 'GitHub', 'GitLab', 'Notion', 'Evernote', 'Roam Research', 'Logseq', 'Anki', 'Reddit', 'VS Code', 'Visual Studio Code', 'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'Todoist', 'NetCero'] }],
    },
  },
  prettierConfig,
]
