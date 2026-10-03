import { controller } from '../../core/http/controller';
import { requireUser } from '../auth/auth.middleware';

export const getMe = controller('getMe', (req, res) => {
  res.json({ user: requireUser(req) });
});
