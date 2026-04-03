import type { Category, CategoryInput } from '../../types';
import { CATEGORY_COLOR_CHOICES, CATEGORY_ICON_CHOICES } from './options';
import type { CategoryDeleteContext, CategoryFormErrors, CategoryFormState } from './types';

export function createCategoryDraft(category?: Category): CategoryFormState {
  return {
    id: category?.id,
    name: category?.name ?? '',
    color: category?.color ?? CATEGORY_COLOR_CHOICES[0].color,
    icon: category?.icon ?? CATEGORY_ICON_CHOICES[0].icon,
  };
}

export function validateCategoryDraft(draft: CategoryFormState): CategoryFormErrors {
  const errors: CategoryFormErrors = {};
  if (!draft.name.trim()) errors.name = 'Category name is required.';
  if (!draft.color) errors.color = 'Pick a color.';
  if (!draft.icon) errors.icon = 'Pick an icon.';
  return errors;
}

export function buildCategoryInput(draft: CategoryFormState): CategoryInput {
  return {
    name: draft.name.trim(),
    color: draft.color,
    icon: draft.icon,
  };
}

export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function canDeleteCategory(context: CategoryDeleteContext) {
  return !context.isDefaultCategory && !context.hasExpenses;
}

export function getCategoryBadgeStyle(category: Pick<Category, 'color' | 'icon' | 'name'>) {
  return {
    backgroundColor: `${category.color}15`,
    color: category.color,
    label: category.name,
    icon: category.icon,
  };
}

export function listCategoryPalette() {
  return CATEGORY_COLOR_CHOICES;
}

export function listCategoryIcons() {
  return CATEGORY_ICON_CHOICES;
}
