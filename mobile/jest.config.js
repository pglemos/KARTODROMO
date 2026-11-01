module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/tests/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/__tests__/style-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 20000,
};
