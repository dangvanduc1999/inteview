import type { RequestHandler } from 'express';
import { controller } from '../../core/http/controller';
import type { AuthSettings } from '../types';
import type { LoginInput, RegisterInput } from './auth.schema';
import { login, register } from './auth.service';
import { signAccessToken } from './token';

const issueToken = (userId: string, auth: AuthSettings) =>
  signAccessToken(userId, auth.jwtSecret, auth.accessTokenTtlSeconds);

export const registerUser = (auth: AuthSettings): RequestHandler =>
  controller<RegisterInput>('registerUser', async (req, res) => {
    const user = await register(req.valid.body, auth.passwordHash);
    req.log.info('user registered', { userId: user.id });
    res.status(201).json({ user, accessToken: issueToken(user.id, auth) });
  });

export const loginUser = (auth: AuthSettings): RequestHandler =>
  controller<LoginInput>('loginUser', async (req, res) => {
    const user = await login(req.valid.body, auth.passwordHash);
    req.log.info('user logged in', { userId: user.id });
    res.json({ user, accessToken: issueToken(user.id, auth) });
  });
