import type { Api } from '../../core/http/api';
import type { ModuleDeps } from '../types';
import { loginUser, registerUser } from './auth.controller';
import { assertEmailFree } from './auth.middleware';
import { loginSchema, registerSchema } from './auth.schema';

export function registerAuthRoutes(api: Api, { auth }: ModuleDeps): void {
  api.post(
    {
      path: '/auth/register',
      validate: registerSchema(auth),
      specs: { summary: 'Register a user', tags: ['auth'] },
    },
    [assertEmailFree, registerUser(auth)],
  );

  api.post(
    {
      path: '/auth/login',
      validate: loginSchema(auth),
      specs: { summary: 'Log in and get an access token', tags: ['auth'] },
    },
    [loginUser(auth)],
  );
}
