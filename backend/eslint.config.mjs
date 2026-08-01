import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['dist', 'prisma/migrations', 'src/docs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
  },
})
