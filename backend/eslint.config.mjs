import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['dist', 'prisma/migrations'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
})
