import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface PasswordHashParams {
  cost: number;
  keyLength: number;
  saltBytes: number;
}

const derive = (password: string, salt: Buffer, keyLength: number, cost: number): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, keyLength, { N: cost }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );

/** Returns `scrypt$<cost>$<salt hex>$<hash hex>`: the cost travels with the hash. */
export async function hashPassword(password: string, params: PasswordHashParams): Promise<string> {
  const salt = randomBytes(params.saltBytes);
  const key = await derive(password, salt, params.keyLength, params.cost);
  return `scrypt$${params.cost}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, costText, saltHex, hashHex] = stored.split('$');
  const cost = Number(costText);
  if (scheme !== 'scrypt' || !Number.isInteger(cost) || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'), expected.length, cost);
  return timingSafeEqual(expected, actual);
}
