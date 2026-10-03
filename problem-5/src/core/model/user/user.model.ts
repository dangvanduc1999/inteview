import { cache } from '../../cache';
import { conflict } from '../../http/errors';
import type { CoreDb } from '../core-db';
import { translateDbErrors } from '../db-errors';

/** Cache key of the authenticated-user lookup; the model drops it whenever the user changes. */
export const userCacheKey = (userId: string) => `user:${userId}`;

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}

export interface UpdateUserData {
  name?: string;
  passwordHash?: string;
}

export class UserModel {
  constructor(private readonly core: CoreDb) {}

  create(data: CreateUserData) {
    return translateDbErrors(this.core.client.user.create({ data }), {
      P2002: () => conflict('Email is already registered'),
    });
  }

  async update(id: string, data: UpdateUserData) {
    try {
      return await this.core.client.user.update({ where: { id }, data });
    } finally {
      await cache.invalidate(userCacheKey(id));
    }
  }

  /** Deletes the user (their books and categories go with them) and cuts their access at once. */
  async remove(id: string) {
    try {
      return await this.core.client.user.delete({ where: { id } });
    } finally {
      await cache.invalidate(userCacheKey(id));
    }
  }

  findById(id: string) {
    return this.core.client.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.core.client.user.findUnique({ where: { email } });
  }
}
