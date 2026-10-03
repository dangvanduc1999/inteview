import type { Api } from '../../core/http/api';
import { getMe } from './users.controller';

export function registerUserRoutes(api: Api): void {
  api.get({ path: '/users/me', auth: true, specs: { summary: 'Current user', tags: ['users'] } }, [
    getMe,
  ]);
}
