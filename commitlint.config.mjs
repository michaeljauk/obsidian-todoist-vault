export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'settings', 'sync', 'renderer', 'parser', 'main', 'build', 'deps', 'docs'],
    ],
    'scope-empty': [2, 'never'],
  },
}
