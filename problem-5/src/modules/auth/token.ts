import jwt from 'jsonwebtoken';

export function signAccessToken(userId: string, secret: string, ttlSeconds: number): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: ttlSeconds, algorithm: 'HS256' });
}

/** Returns the user id, or `null` when the token is invalid or expired. */
export function verifyAccessToken(token: string, secret: string): string | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
