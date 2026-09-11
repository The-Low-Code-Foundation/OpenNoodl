module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['/node_modules/'],
  // The drift and language-service suites build TypeScript programs; 5s is not enough.
  testTimeout: 30000
};
