import type { LucideIcon } from 'lucide-react';
import {
  Book,
  Briefcase,
  CarFront,
  Coffee,
  Gamepad2,
  Gift,
  Heart,
  HeartPulse,
  Home,
  Music,
  Plane,
  ReceiptText,
  Smartphone,
  ShoppingCart,
  Tag,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';

export type CategoryIconOption = {
  value: string;
  label: string;
  Icon: LucideIcon;
};

const ICONS = {
  'shopping-cart': ShoppingCart,
  utensils: UtensilsCrossed,
  car: CarFront,
  home: Home,
  heart: Heart,
  zap: Zap,
  briefcase: Briefcase,
  plane: Plane,
  coffee: Coffee,
  'gamepad-2': Gamepad2,
  music: Music,
  book: Book,
  gift: Gift,
  smartphone: Smartphone,
  'receipt-text': ReceiptText,
  'heart-pulse': HeartPulse,
  default: Tag,
} as const;

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { value: 'shopping-cart', label: 'Shopping', Icon: ShoppingCart },
  { value: 'utensils', label: 'Food', Icon: UtensilsCrossed },
  { value: 'car', label: 'Transport', Icon: CarFront },
  { value: 'home', label: 'Housing', Icon: Home },
  { value: 'heart', label: 'Health', Icon: Heart },
  { value: 'zap', label: 'Savings', Icon: Zap },
  { value: 'briefcase', label: 'Work', Icon: Briefcase },
  { value: 'plane', label: 'Travel', Icon: Plane },
  { value: 'coffee', label: 'Coffee', Icon: Coffee },
  { value: 'gamepad-2', label: 'Games', Icon: Gamepad2 },
  { value: 'music', label: 'Music', Icon: Music },
  { value: 'book', label: 'Education', Icon: Book },
  { value: 'gift', label: 'Gift', Icon: Gift },
  { value: 'smartphone', label: 'Tech', Icon: Smartphone },
  { value: 'receipt-text', label: 'Bills', Icon: ReceiptText },
];

function normalizeIconName(iconName: string) {
  return iconName.trim().toLowerCase().replaceAll('_', '-');
}

export function getCategoryIcon(iconName: string): LucideIcon {
  return ICONS[normalizeIconName(iconName) as keyof typeof ICONS] ?? ICONS.default;
}

export function formatCategory(name: string) {
  return name
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
