import type { Category } from '../../types';

export interface CategoryFormState {
  id?: string;
  name: string;
  color: string;
  icon: string;
}

export interface CategoryPickerChoice {
  color: string;
  label: string;
}

export interface CategoryIconChoice {
  icon: string;
  label: string;
}

export interface CategoryFormErrors {
  name?: string;
  color?: string;
  icon?: string;
}

export interface CategoryDeleteContext {
  category: Category;
  hasExpenses: boolean;
  isDefaultCategory: boolean;
}
