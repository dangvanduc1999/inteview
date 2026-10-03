import type { User } from '@prisma/client';
import { unauthorized } from '../../core/http/errors';
import { model } from '../../core/model';
import type { LoginInput, RegisterInput } from './auth.schema';
import { hashPassword, verifyPassword, type PasswordHashParams } from './password';

/** The user as the API shows it. Plain JSON values, so it can also live in the cache. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export const toPublicUser = ({ id, email, name, createdAt }: User): PublicUser => ({
  id,
  email,
  name,
  createdAt: createdAt.toISOString(),
});

// Verified against when the email is unknown, so both failure paths take similar time.
let dummyHash: Promise<string> | undefined;
const getDummyHash = (params: PasswordHashParams) =>
  (dummyHash ??= hashPassword('not-a-real-password', params));

// `assertEmailFree` runs before this on the route; the model still answers 409 on a race.
export async function register(
  input: RegisterInput,
  hashParams: PasswordHashParams,
): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password, hashParams);
  const { email, name } = input;
  return toPublicUser(await model.user.create({ email, name, passwordHash }));
}

export async function login(
  input: LoginInput,
  hashParams: PasswordHashParams,
): Promise<PublicUser> {
  const user = await model.user.findByEmail(input.email);
  const ok = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await getDummyHash(hashParams)),
  );
  if (!user || !ok) throw unauthorized('Invalid credentials');
  return toPublicUser(user);
}
