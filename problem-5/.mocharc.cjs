// Spec globs are passed on the command line (see package.json and scripts/test.sh):
// Mocha appends CLI specs to a configured `spec`, so setting it here would break file filtering.
module.exports = {
  require: ['tsx/cjs'],
  file: ['test/setup.ts'],
  timeout: 10000,
  exit: false,
};
