import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../../../src/modules/auth/password';
import { signAccessToken, verifyAccessToken } from '../../../src/modules/auth/token';

const params = { cost: 1024, keyLength: 32, saltBytes: 16 };

describe('password', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse', params);
    expect(await verifyPassword('correct horse', hash)).to.equal(true);
    expect(await verifyPassword('wrong', hash)).to.equal(false);
  });

  it('uses a different salt per hash', async () => {
    expect(await hashPassword('same', params)).to.not.equal(await hashPassword('same', params));
  });

  it('verifies hashes made with another cost, because the cost is stored with the hash', async () => {
    const old = await hashPassword('pw', { ...params, cost: 2048 });
    expect(await verifyPassword('pw', old)).to.equal(true);
  });

  it('rejects malformed stored values', async () => {
    expect(await verifyPassword('x', 'garbage')).to.equal(false);
  });
});

describe('access token', () => {
  const secret = 's'.repeat(32);

  it('round-trips the user id', () => {
    expect(verifyAccessToken(signAccessToken('u1', secret, 60), secret)).to.equal('u1');
  });

  it('rejects wrong secret, tampering, garbage and expired tokens', () => {
    const token = signAccessToken('u1', secret, 60);
    expect(verifyAccessToken(token, 'o'.repeat(32))).to.equal(null);
    expect(verifyAccessToken(`${token}x`, secret)).to.equal(null);
    expect(verifyAccessToken('garbage', secret)).to.equal(null);
    const expired = jwt.sign({}, secret, { subject: 'u1', expiresIn: -10 });
    expect(verifyAccessToken(expired, secret)).to.equal(null);
  });
});
