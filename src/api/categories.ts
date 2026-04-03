import type { Category, CategoryInput } from '../types';
import { apiClient } from './client';

export const categoriesApi = {
  getAll(): Promise<Category[]> {
    return apiClient.categories.list();
  },
  create(input: CategoryInput): Promise<Category> {
    return apiClient.categories.create(input);
  },
  update(categoryId: string, input: Partial<CategoryInput>): Promise<Category> {
    return apiClient.categories.update(categoryId, input);
  },
  delete(categoryId: string): Promise<void> {
    return apiClient.categories.remove(categoryId);
  },
};
