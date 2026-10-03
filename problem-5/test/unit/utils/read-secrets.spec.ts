import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { readSecrets } from '../../../src/utils/read-secrets';

const write = (content: string): string => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'secrets-')), 'secrets.json');
  writeFileSync(file, content);
  return file;
};

describe('readSecrets', () => {
  it('parses a JSON object', () => {
    const secrets = { db: { host: 'h' } };
    expect(readSecrets(write(JSON.stringify(secrets)))).to.deep.equal(secrets);
  });

  it('explains how to create a missing file', () => {
    expect(() => readSecrets('/nonexistent/secrets.json')).to.throw(/secrets\.example\.json/);
  });

  it('rejects invalid JSON and non-object JSON without echoing the content', () => {
    expect(() => readSecrets(write('{oops'))).to.throw(/not valid JSON/);
    expect(() => readSecrets(write('[1]'))).to.throw(/JSON object/);
  });
});
