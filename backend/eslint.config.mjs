import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['dist'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
})
