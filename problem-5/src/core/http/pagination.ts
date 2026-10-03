import Joi from 'joi';

export interface PaginationSettings {
  defaultLimit: number;
  maxLimit: number;
}

export const paginationKeys = ({ defaultLimit, maxLimit }: PaginationSettings) => ({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(maxLimit).default(defaultLimit),
});

export interface PageQuery {
  page: number;
  limit: number;
}

export const toSkipTake = ({ page, limit }: PageQuery) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const buildMeta = (total: number, { page, limit }: PageQuery) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
