module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'compiler/**/*.ts',
    'runtime/**/*.ts',
    'stdlib/**/*.ts',
    'mcp/**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
