import Joi from 'joi';
import type { AuthSettings } from '../types';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export type LoginInput = Pick<RegisterInput, 'email' | 'password'>;

const email = Joi.string().trim().lowercase().email().max(254).required();

export const registerSchema = ({ passwordMinLength, passwordMaxLength }: AuthSettings) =>
  Joi.object<RegisterInput>({
    email,
    password: Joi.string().min(passwordMinLength).max(passwordMaxLength).required(),
    name: Joi.string().trim().min(1).max(100).required(),
  });

export const loginSchema = ({ passwordMaxLength }: AuthSettings) =>
  Joi.object<LoginInput>({
    email,
    password: Joi.string().max(passwordMaxLength).required(),
  });
