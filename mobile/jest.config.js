module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/__tests__/style-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
