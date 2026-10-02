const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCountryName, normalizeRegionName } = require('../src/lib/geo');

test('normalizes known country codes to full names', () => {
  assert.equal(normalizeCountryName('IN'), 'India');
  assert.equal(normalizeCountryName('US'), 'United States');
  assert.equal(normalizeCountryName('Unknown'), 'Unknown');
});

test('normalizes known state and region codes to full names', () => {
  assert.equal(normalizeRegionName('IN', 'BR'), 'Bihar');
  assert.equal(normalizeRegionName('IN', 'GJ'), 'Gujarat');
  assert.equal(normalizeRegionName('US', 'OK'), 'Oklahoma');
  assert.equal(normalizeRegionName('US', 'Unknown'), 'Unknown');
});
