import type { CategoryIconChoice, CategoryPickerChoice } from './types';

export const CATEGORY_COLOR_CHOICES: CategoryPickerChoice[] = [
  { color: '#4c40df', label: 'Indigo' },
  { color: '#f74b6d', label: 'Coral' },
  { color: '#0057bd', label: 'Blue' },
  { color: '#006a2d', label: 'Green' },
  { color: '#b45309', label: 'Amber' },
  { color: '#7c3aed', label: 'Violet' },
  { color: '#0f766e', label: 'Teal' },
  { color: '#be123c', label: 'Rose' },
];

export const CATEGORY_ICON_CHOICES: CategoryIconChoice[] = [
  { icon: 'shopping-cart', label: 'Shopping' },
  { icon: 'utensils', label: 'Food' },
  { icon: 'car', label: 'Transport' },
  { icon: 'home', label: 'Housing' },
  { icon: 'zap', label: 'Savings' },
  { icon: 'receipt-text', label: 'Bills' },
  { icon: 'book', label: 'Education' },
  { icon: 'plane', label: 'Travel' },
  { icon: 'coffee', label: 'Coffee' },
  { icon: 'heart', label: 'Health' },
];
