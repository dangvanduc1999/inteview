import Joi from 'joi';

export interface CategoryInput {
  name: string;
}

export interface CategoryParams {
  id: string;
}

const name = Joi.string().trim().min(1).max(50).required();

export const createCategorySchema = Joi.object<CategoryInput>({ name });
export const updateCategorySchema = Joi.object<CategoryInput>({ name });
export const categoryParamsSchema = Joi.object<CategoryParams>({
  id: Joi.string().uuid().required(),
});
