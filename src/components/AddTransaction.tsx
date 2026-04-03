import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronDown, Delete, Folder, Paperclip, Repeat2, TextCursorInput, TrendingUp, X } from 'lucide-react';
import type { Category, CategoryInput, CurrencyCode, ExpenseType, RecurrenceFrequency } from '../types';
import { InlineNotice } from './shell';
import CustomSelect from './ui/CustomSelect';
import { CATEGORY_ICON_OPTIONS, formatCategory, getCategoryIcon } from './ui/categoryIcons';
import { CURRENCIES } from '../constants/currencies';
import { haptic, ImpactStyle } from '../lib/native';
import { getCategoryColor, withAlpha } from '../lib/ui';
import { normalizeImageFile } from '../utils/imageUtils';

export interface ExpenseComposerDraft {
  type?: ExpenseType;
  amount: string;
  currency: CurrencyCode;
  categoryId: string | null;
  groupId?: string | null;
  description: string;
  expenseDate: string;
  receiptUrl: string;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceInterval: number;
}

export interface AddTransactionModalProps {
  open: boolean;
  categories: Category[];
  groups?: Array<{ id: string; name: string }>;
  defaultCurrency?: CurrencyCode;
  initialType?: ExpenseType;
  initialDraft?: Partial<ExpenseComposerDraft> | null;
  heading?: string;
  submitLabel?: string;
  isSaving?: boolean;
  isUploadingReceipt?: boolean;
  isImportingReceipts?: boolean;
  onClose: () => void;
  onSave: (draft: ExpenseComposerDraft) => void | Promise<void>;
  onUploadReceipt?: (file: File) => Promise<string>;
  onAutoImportReceipts?: (files: File[]) => Promise<{ created: number; failed: number }>;
  onCreateCategory?: (input: CategoryInput) => Promise<Category | void> | Category | void;
}

const currencySelectOptions = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.name} (${currency.symbol})`,
}));
const recurrenceSelectOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const incomeSourceOptions = [
  'Salary',
  'Freelance',
  'Consulting',
  'Investment',
  'Gift',
  'Refund',
  'Other Income',
] as const;
const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

function inferCategoryIcon(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes('food') || normalized.includes('grocer') || normalized.includes('restaurant')) return 'utensils';
  if (normalized.includes('travel') || normalized.includes('flight')) return 'plane';
  if (normalized.includes('health') || normalized.includes('medical')) return 'heart-pulse';
  if (normalized.includes('home') || normalized.includes('rent')) return 'home';
  if (normalized.includes('coffee')) return 'coffee';
  if (normalized.includes('car') || normalized.includes('fuel') || normalized.includes('transport')) return 'car';
  if (normalized.includes('shop') || normalized.includes('cloth')) return 'shopping-cart';
  if (normalized.includes('gift')) return 'gift';
  if (normalized.includes('phone') || normalized.includes('tech')) return 'smartphone';

  const matched = CATEGORY_ICON_OPTIONS.find((choice) => {
    const label = choice.label.trim().toLowerCase();
    return normalized.includes(label) || label.includes(normalized);
  });

  return matched?.value ?? 'tag';
}

function NativeSelectField({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="relative flex h-11 w-full items-center rounded-[var(--radius-sm)] border border-[var(--border-md)] bg-[var(--bg-card)] px-4 shadow-[var(--shadow)] transition-colors focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full appearance-none bg-transparent pr-7 text-sm text-[var(--text-1)] outline-none"
          aria-label={placeholder}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-[var(--text-2)]" />
      </div>
    </div>
  );
}

function NativeDateField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
    input.focus();
  };

  return (
    <label
      className={`picker-shell h-11 shrink-0 ${className ?? ''}`}
      aria-label="Choose date"
      onClick={openPicker}
    >
      <CalendarDays className="h-4 w-4 text-on-surface-variant" />
      <span className="truncate text-sm font-medium text-on-surface">
        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))}
      </span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="picker-native"
        tabIndex={-1}
      />
    </label>
  );
}

function formatAmountDisplay(amount: string) {
  if (!amount) return '0.00';
  return amount;
}

function updateAmount(current: string, key: typeof keypad[number]) {
  if (key === 'back') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (current.includes('.')) return current;
    return current ? `${current}.` : '0.';
  }

  if (current === '0') {
    return key;
  }

  return `${current}${key}`;
}

export default function AddTransactionModal({
  open,
  categories,
  groups = [],
  defaultCurrency = 'USD',
  initialType = 'expense',
  initialDraft,
  heading = 'New expense',
  submitLabel = 'Add expense',
  isSaving = false,
  isUploadingReceipt = false,
  isImportingReceipts = false,
  onClose,
  onSave,
  onUploadReceipt,
  onAutoImportReceipts,
  onCreateCategory,
}: AddTransactionModalProps) {
  const [transactionType, setTransactionType] = useState<ExpenseType>(initialType);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [incomeSource, setIncomeSource] = useState<string | null>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiptProcessingStatus, setReceiptProcessingStatus] = useState('');
  const [inlineCategoryOpen, setInlineCategoryOpen] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [isCreatingInlineCategory, setIsCreatingInlineCategory] = useState(false);
  const [optimisticCategory, setOptimisticCategory] = useState<Category | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextType = initialDraft?.type ?? initialType;
    setTransactionType(nextType);
    setAmount(initialDraft?.amount ?? '');
    setCurrency(initialDraft?.currency ?? defaultCurrency);
    setCategoryId(initialDraft?.categoryId ?? categories[0]?.id ?? null);
    setGroupId(initialDraft?.groupId ?? null);
    const nextCategory = categories.find((category) => category.id === (initialDraft?.categoryId ?? categories[0]?.id ?? null));
    const nextSource = nextType === 'income'
      ? incomeSourceOptions.find((option) => option.toLowerCase() === nextCategory?.name?.trim().toLowerCase()) ?? null
      : null;
    setIncomeSource(nextSource);
    setSourcePickerOpen(false);
    setDescription(initialDraft?.description ?? '');
    setExpenseDate(initialDraft?.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setReceiptUrl(initialDraft?.receiptUrl ?? '');
    setIsRecurring(initialDraft?.isRecurring ?? false);
    setRecurrenceFrequency(initialDraft?.recurrenceFrequency ?? 'monthly');
    setRecurrenceInterval(initialDraft?.recurrenceInterval ?? 1);
    setFormError(null);
    setInlineCategoryOpen(false);
    setInlineCategoryName('');
    setIsCreatingInlineCategory(false);
    setOptimisticCategory(null);
  }, [open, categories, defaultCurrency, initialDraft, initialType]);

  useEffect(() => {
    if (!optimisticCategory) return;
    if (categories.some((category) => category.id === optimisticCategory.id)) {
      setOptimisticCategory(null);
    }
  }, [categories, optimisticCategory]);

  const availableCategories = useMemo(() => {
    if (!optimisticCategory) return categories;
    if (categories.some((category) => category.id === optimisticCategory.id)) return categories;
    return [optimisticCategory, ...categories];
  }, [categories, optimisticCategory]);

  useEffect(() => {
    if (transactionType === 'expense') {
      setSourcePickerOpen(false);
      if (!categoryId && availableCategories[0]?.id) {
        setCategoryId(availableCategories[0].id);
      }
      return;
    }

    const currentCategory = availableCategories.find((category) => category.id === categoryId) ?? null;
    const matchedSource = incomeSourceOptions.find((option) => option.toLowerCase() === currentCategory?.name?.trim().toLowerCase()) ?? null;
    if (!matchedSource && currentCategory) {
      setCategoryId(null);
    }
    setIncomeSource((current) => current ?? matchedSource ?? null);
  }, [availableCategories, categoryId, transactionType]);

  const selectedCategory = useMemo(
    () => availableCategories.find((category) => category.id === categoryId) ?? availableCategories[0] ?? null,
    [availableCategories, categoryId],
  );
  const selectedColor = getCategoryColor(selectedCategory?.name ?? 'Uncategorized');
  const isIncome = transactionType === 'income';
  const selectedIncomeCategory = useMemo(
    () => availableCategories.find((category) => category.name.trim().toLowerCase() === (incomeSource ?? '').trim().toLowerCase()) ?? null,
    [availableCategories, incomeSource],
  );
  const displayCategory = isIncome ? selectedIncomeCategory : selectedCategory;
  const displayColor = getCategoryColor(displayCategory?.name ?? incomeSource ?? 'Income');
  const isEditing = heading.toLowerCase().includes('edit') || submitLabel.toLowerCase().includes('update');
  const displayHeaderLabel = isIncome ? 'Income entry' : 'Expense sheet';
  const displayTitle = isEditing
    ? isIncome ? 'Edit income' : 'Edit expense'
    : isIncome ? 'New income' : heading;
  const displaySubmitLabel = isIncome
    ? (isEditing ? 'Update income' : 'Add income')
    : submitLabel;

  const handleSelectIncomeSource = (source: string) => {
    const matchedCategory = availableCategories.find((category) => category.name.trim().toLowerCase() === source.trim().toLowerCase()) ?? null;
    setIncomeSource(source);
    setCategoryId(matchedCategory?.id ?? null);
    setSourcePickerOpen(false);
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      setFormError('Enter a valid amount before saving.');
      return;
    }

    if (!description.trim()) {
      setFormError('Add a short description before saving.');
      return;
    }

    setFormError(null);

    await onSave({
      type: transactionType,
      amount,
      currency,
      categoryId,
      groupId,
      description,
      expenseDate,
      receiptUrl,
      isRecurring,
      recurrenceFrequency,
      recurrenceInterval,
    });
  };

  const handleInlineCreateCategory = async () => {
    if (!onCreateCategory) return;
    const normalizedName = inlineCategoryName.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setFormError('Enter a category name first.');
      return;
    }

    const existing = availableCategories.find((category) => category.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      setInlineCategoryOpen(false);
      setInlineCategoryName('');
      setFormError(null);
      return;
    }

    setIsCreatingInlineCategory(true);
    setFormError(null);

    try {
      const created = await onCreateCategory({
        name: normalizedName,
        color: getCategoryColor(normalizedName),
        icon: inferCategoryIcon(normalizedName),
      });
      if (created && 'id' in created) {
        setOptimisticCategory(created);
        setCategoryId(created.id);
      }
      setInlineCategoryOpen(false);
      setInlineCategoryName('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create category.');
    } finally {
      setIsCreatingInlineCategory(false);
    }
  };

  const handleReceiptFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) {
      return;
    }
    const files: File[] = Array.from(fileList);

    setFormError(null);
    setReceiptProcessingStatus('Converting…');

    try {
      const normalizedFiles = await Promise.all(files.map((file) => normalizeImageFile(file)));
      setReceiptProcessingStatus('');

      if (onAutoImportReceipts) {
        const result = await onAutoImportReceipts(normalizedFiles);
        if (result.created > 0 && result.failed === 0) {
          setFormError(null);
        } else if (result.created > 0) {
          setFormError(`Imported ${result.created} receipt(s). ${result.failed} failed.`);
        } else {
          setFormError('Could not auto-import the selected receipt(s).');
        }
      } else if (onUploadReceipt) {
        const url = await onUploadReceipt(normalizedFiles[0]!);
        setReceiptUrl(url);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Receipt upload failed.');
    } finally {
      setReceiptProcessingStatus('');
      event.target.value = '';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="expense-sheet-overlay expense-sheet-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          <motion.section
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="expense-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-[24px] border border-outline/10 bg-surface-container-low shadow-[var(--shadow)]"
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-outline/40" />
            <div className="px-5 pt-4">
              <div
                className="mx-auto mb-5 flex w-fit items-center gap-0.5 rounded-full p-[3px]"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                {(['expense', 'income'] as const).map((option) => {
                  const active = option === transactionType;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTransactionType(option)}
                      className="relative overflow-hidden rounded-full px-6 py-2 text-sm font-medium"
                      style={{ color: active ? '#fff' : 'var(--text-2)' }}
                    >
                      {active && (
                        <motion.span
                          layoutId="activeTab"
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: option === 'expense' ? 'var(--red)' : 'var(--green)' }}
                        />
                      )}
                      <span className="relative z-10 capitalize">{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">{displayHeaderLabel}</p>
                <h2 className="mt-1 text-lg font-semibold text-on-surface">{displayTitle}</h2>
              </div>
              <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container">
                <X className="h-4 w-4 text-on-surface" />
              </motion.button>
            </div>

            <div className="overflow-y-auto px-5 pb-5">
              <div className="rounded-[24px] px-2 py-4 text-center">
                <p className="text-[40px] font-bold tracking-[-0.03em]" style={{ color: isIncome ? 'var(--green)' : 'var(--text-1)' }}>
                  {isIncome ? '+' : ''}
                  {formatAmountDisplay(amount)}
                </p>
                <div className="mt-2 text-sm text-on-surface-variant">{currency}</div>
              </div>

              <div className="chip-row chip-row-scroll horizontal-scroll mt-4 flex gap-2 overflow-x-auto hide-scrollbar">
                {isIncome ? (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setSourcePickerOpen((current) => !current)}
                    className="flex min-w-[180px] shrink-0 flex-col items-start justify-center rounded-full border border-outline/10 bg-surface-container px-4 py-2 text-left"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">Source</span>
                    <span className="mt-0.5 text-sm font-medium text-on-surface">{incomeSource ?? 'Choose source'}</span>
                  </motion.button>
                ) : (
                  <div className="min-w-[180px] shrink-0">
                    <NativeSelectField
                      value={categoryId ?? ''}
                      onChange={(value) => setCategoryId(value || null)}
                      options={availableCategories.map((category) => ({
                        value: category.id,
                        label: formatCategory(category.name),
                      }))}
                      placeholder="Choose category"
                      className="w-full"
                    />
                  </div>
                )}
                <NativeDateField value={expenseDate} onChange={setExpenseDate} className="rounded-full bg-surface-container" />
                <label className="flex h-11 min-w-[180px] items-center gap-2 rounded-full border border-outline/10 bg-surface-container px-4 text-sm font-medium text-on-surface">
                  <TextCursorInput className="h-4 w-4 text-on-surface-variant" />
                  <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="w-full bg-transparent outline-none" />
                </label>
              </div>

              {isIncome && sourcePickerOpen && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {incomeSourceOptions.map((source) => {
                    const active = source === incomeSource;
                    return (
                      <motion.button
                        key={source}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => handleSelectIncomeSource(source)}
                        className="rounded-full border px-4 py-2 text-sm font-medium"
                        style={{
                          borderColor: active ? 'var(--green)' : 'var(--border-md)',
                          backgroundColor: active ? 'var(--green-soft)' : 'var(--bg-card)',
                          color: active ? 'var(--green)' : 'var(--text-1)',
                        }}
                      >
                        {source}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              <div className="chip-row chip-row-scroll mt-3 flex flex-wrap gap-2">
                <div className="min-w-[180px] shrink-0">
                  <CustomSelect
                    value={currency}
                    onChange={(value) => setCurrency(value as CurrencyCode)}
                    options={currencySelectOptions}
                    placeholder="Currency"
                    className="w-full"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  disabled={Boolean(receiptProcessingStatus)}
                  onClick={() => receiptInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-outline/10 bg-surface-container px-4 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Paperclip className="h-4 w-4 text-on-surface-variant" />
                  {receiptProcessingStatus
                    ? receiptProcessingStatus
                    : isImportingReceipts
                    ? 'Importing…'
                    : isUploadingReceipt
                      ? 'Uploading…'
                      : onAutoImportReceipts
                        ? 'Import receipts'
                        : receiptUrl
                          ? 'Receipt linked'
                          : 'Attach receipt'}
                </motion.button>
                <label className="inline-flex h-10 items-center gap-2 rounded-full border border-outline/10 bg-surface-container px-4 text-sm text-on-surface">
                  <Repeat2 className="h-4 w-4 text-on-surface-variant" />
                  <input type="checkbox" checked={isRecurring} onChange={(event) => setIsRecurring(event.target.checked)} />
                  Recurring
                </label>
                {onCreateCategory && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setInlineCategoryOpen((current) => !current)}
                    className="inline-flex h-10 items-center rounded-full border border-outline/10 bg-surface-container px-4 text-sm text-primary"
                  >
                    New category
                  </motion.button>
                )}
              </div>

              {inlineCategoryOpen && (
                <div className="mt-3 rounded-[var(--radius-md)] border border-outline/10 bg-surface-container px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Create category</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={inlineCategoryName}
                      onChange={(event) => setInlineCategoryName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleInlineCreateCategory();
                        }
                      }}
                      placeholder="Category name"
                      className="input-shell h-11 flex-1"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => {
                          setInlineCategoryOpen(false);
                          setInlineCategoryName('');
                          setFormError(null);
                        }}
                        className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] border border-outline/10 bg-surface-container-low px-4 text-sm font-medium text-on-surface"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        disabled={isCreatingInlineCategory}
                        onClick={() => void handleInlineCreateCategory()}
                        className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {isCreatingInlineCategory ? 'Creating…' : 'Create'}
                      </motion.button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">This creates the category here and selects it for this transaction.</p>
                </div>
              )}

              <input ref={receiptInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleReceiptFile} />

              {isRecurring && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <CustomSelect
                    value={recurrenceFrequency}
                    onChange={(value) => setRecurrenceFrequency(value as RecurrenceFrequency)}
                    options={recurrenceSelectOptions}
                    placeholder="Recurring frequency"
                    className="w-full"
                  />
                  <input type="number" min={1} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(Number(event.target.value))} className="input-shell" />
                </div>
              )}

              {groups.length > 0 && (
                <div className="mt-3 rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Share with group</p>
                      <p className="mt-1 text-[13px] text-on-surface-variant">Optional. Add this expense to a shared budget.</p>
                    </div>
                    {groupId ? (
                      <button
                        type="button"
                        onClick={() => setGroupId(null)}
                        className="rounded-full bg-surface-container px-3 py-2 text-[12px] font-semibold text-on-surface-variant"
                      >
                        Private
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {groups.map((group) => {
                      const active = group.id === groupId;
                      return (
                        <motion.button
                          key={group.id}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => setGroupId(active ? null : group.id)}
                          className="min-h-11 rounded-full border px-4 py-2 text-sm font-medium"
                          style={{
                            borderColor: active ? 'var(--accent)' : 'var(--border-md)',
                            backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-card)',
                            color: active ? 'var(--accent)' : 'var(--text-1)',
                          }}
                        >
                          {group.name}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: isIncome ? 'var(--green-soft)' : withAlpha(displayColor, 0.18), color: isIncome ? 'var(--green)' : displayColor }}>
                      {isIncome
                        ? <TrendingUp className="h-4 w-4" />
                        : displayCategory ? React.createElement(getCategoryIcon(displayCategory.icon), { className: 'h-4 w-4' }) : <Folder className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-on-surface">
                        {isIncome
                          ? incomeSource ?? 'Choose a source'
                          : displayCategory ? formatCategory(displayCategory.name) : 'Choose a category'}
                      </p>
                      <p className="text-xs text-on-surface-variant">{expenseDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: isIncome ? 'var(--green)' : 'var(--text-1)' }}>
                      {isIncome ? '+' : ''}
                      {formatAmountDisplay(amount)}
                    </p>
                    <p className="text-xs text-on-surface-variant">{currency}</p>
                  </div>
                </div>
              </div>

              {formError && <div className="mt-3"><InlineNotice tone="error" title="Cannot save expense" message={formError} /></div>}

              <div className="numpad-grid mt-5 grid grid-cols-3 gap-3">
                {keypad.map((key) => (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      void haptic(ImpactStyle.Light);
                      setAmount((current) => updateAmount(current, key));
                    }}
                    className="numpad-btn numpad-button flex h-16 items-center justify-center rounded-[var(--radius-sm)] bg-surface-container text-2xl font-medium text-on-surface"
                  >
                    {key === 'back' ? <Delete className="h-6 w-6" /> : key}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="border-t border-outline/10 px-5 pb-[calc(var(--keyboard-height)+var(--sab)+20px)] pt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="ui-btn h-14 w-full text-base disabled:opacity-50"
                style={{
                  backgroundColor: isIncome ? 'var(--green)' : 'var(--accent)',
                  color: '#fff',
                }}
              >
                {isIncome && <TrendingUp className="h-4 w-4" />}
                {isSaving ? 'Saving…' : displaySubmitLabel}
              </motion.button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
