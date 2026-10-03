import { expect } from 'chai';
import { deepMerge, isPlainObject } from '../../../src/utils/merge';

describe('deepMerge', () => {
  it('merges nested objects, replaces arrays and scalars, and ignores undefined', () => {
    const base = { a: { b: 1, c: 2 }, list: [1, 2], keep: 'x' };
    const merged = deepMerge(base, { a: { b: 9 }, list: [3], keep: undefined });
    expect(merged).to.deep.equal({ a: { b: 9, c: 2 }, list: [3], keep: 'x' });
  });

  it('adds keys that only exist in the override', () => {
    expect(deepMerge({ a: 1 }, { b: { c: 2 } })).to.deep.equal({ a: 1, b: { c: 2 } });
  });

  it('does not mutate its inputs', () => {
    const base = { a: { b: 1 } };
    const override = { a: { c: 2 } };
    deepMerge(base, override);
    expect(base).to.deep.equal({ a: { b: 1 } });
    expect(override).to.deep.equal({ a: { c: 2 } });
  });
});

describe('isPlainObject', () => {
  it('is true only for non-null, non-array objects', () => {
    expect(isPlainObject({})).to.equal(true);
    expect(isPlainObject([])).to.equal(false);
    expect(isPlainObject(null)).to.equal(false);
    expect(isPlainObject('x')).to.equal(false);
  });
});
