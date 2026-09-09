// jest-dom matchers aren't installed here, so this file only carries the
// polyfills the test suite actually needs.
//
// jsdom's test environment (as configured by react-scripts/jest) does not
// expose TextEncoder/TextDecoder globally the way a real browser does, but
// services/api.js's SSE parsing relies on both — polyfill from Node's `util`
// so tests exercise the real code path instead of a rewritten one.
const { TextEncoder, TextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
