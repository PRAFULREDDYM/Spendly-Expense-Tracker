import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, X } from 'lucide-react';
import { haptic, ImpactStyle } from '../lib/native';
import { getCategoryColor, withAlpha } from '../lib/ui';
import { formatCategory } from './ui/categoryIcons';

export type QuickAddCategory = {
  id: string;
  name: string;
  color?: string;
};

export type QuickAddGroup = {
  id: string;
  name: string;
};

export type QuickAddExpense = {
  amount: number;
  description: string;
  categoryId: string;
  groupId?: string | null;
};

export interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: QuickAddExpense) => void | Promise<void>;
  categories?: QuickAddCategory[];
  groups?: QuickAddGroup[];
  currencySymbol?: string;
  onOpenProfile?: () => void;
  compact?: boolean;
  initialDescription?: string;
}

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

function pushAmountDigit(current: string, key: (typeof keypad)[number]) {
  if (key === 'back') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (current.includes('.')) {
      return current;
    }
    return current ? `${current}.` : '0.';
  }

  if (current.includes('.')) {
    const [, decimals = ''] = current.split('.');
    if (decimals.length >= 2) {
      return current;
    }
  }

  if (current === '0') {
    return key;
  }

  return `${current}${key}`;
}

function formatAmountDisplay(amount: string) {
  if (!amount) {
    return '0.00';
  }

  if (amount.endsWith('.')) {
    return `${amount}00`;
  }

  const [whole, decimals = ''] = amount.split('.');
  return `${whole || '0'}.${`${decimals}00`.slice(0, 2)}`;
}

export default function QuickAdd({
  isOpen,
  onClose,
  onSave,
  categories = [],
  groups = [],
  currencySymbol = '$',
  onOpenProfile,
  compact = false,
  initialDescription = '',
}: QuickAddProps) {
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const descriptionRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep(0);
    setAmount('');
    setDescription(initialDescription);
    setCategoryId(categories[0]?.id ?? null);
    setGroupId(null);
    setIsSaving(false);
    setSaved(false);
  }, [categories, initialDescription, isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 1) {
      return;
    }

    window.setTimeout(() => {
      descriptionRef.current?.focus();
    }, 120);
  }, [isOpen, step]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const canContinue =
    (step === 0 && Number.parseFloat(amount || '0') > 0) ||
    step === 1 ||
    (step === 2 && Boolean(categoryId));

  const handlePrimaryAction = async () => {
    if (step < 2) {
      if (!canContinue) {
        return;
      }
      setStep((current) => current + 1);
      return;
    }

    if (!categoryId) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        amount: Number.parseFloat(amount || '0'),
        description: description.trim() || 'Expense',
        categoryId,
        groupId,
      });
      setSaved(true);
      window.setTimeout(() => {
        setSaved(false);
        onClose();
      }, 300);
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    if (step === 0) {
      onClose();
      return;
    }

    setStep((current) => current - 1);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[190] bg-[rgba(6,8,15,0.52)] backdrop-blur-[2px]"
            onClick={onClose}
            aria-label="Close quick add"
          />

          <motion.section
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={`quick-add-panel fixed left-0 right-0 top-0 z-[200] mx-auto w-full overflow-hidden rounded-b-[24px] border border-white/8 bg-[var(--bg-card)] shadow-[0_8px_40px_rgba(0,0,0,0.4)] ${compact ? 'max-w-sm' : 'max-w-2xl'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`transition-colors duration-200 ${saved ? 'bg-[var(--green)]' : ''}`}>
              <div
                className={`${compact ? 'px-3 pt-[calc(var(--sat)+12px)]' : 'px-4 pt-[calc(var(--sat)+16px)] sm:px-6'}`}
                style={{ paddingBottom: 'calc(var(--keyboard-height) + 20px)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className={`text-sm font-medium ${step === 0 ? 'invisible' : 'text-[var(--text-2)]'}`}
                  >
                    Back
                  </button>

                  <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className={`h-2.5 w-2.5 rounded-full transition-colors ${dot === step ? 'bg-[var(--accent)]' : 'bg-[var(--border-md)]'}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-2)]"
                    aria-label="Close quick add"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className={compact ? 'mt-4 min-h-[340px]' : 'mt-5 min-h-[420px]'}>
                  <AnimatePresence mode="wait">
                    {step === 0 ? (
                      <motion.div
                        key="amount-step"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <p className="text-[13px] text-[var(--text-2)]">How much?</p>
                          <div className="mt-3 flex items-start justify-center gap-2">
                            <span className={`${compact ? 'pt-1 text-[18px]' : 'pt-2 text-[24px]'} font-semibold text-[var(--text-2)]`}>{currencySymbol}</span>
                            <p className={`${compact ? 'text-[36px]' : 'text-[48px]'} font-bold tracking-[-0.04em] text-[var(--text-1)]`}>
                              {formatAmountDisplay(amount)}
                            </p>
                          </div>
                        </div>

                        <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3'}`}>
                          {keypad.map((key) => (
                            <motion.button
                              key={key}
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => {
                                void haptic(ImpactStyle.Light);
                                setAmount((current) => pushAmountDigit(current, key));
                              }}
                              className={`quick-add-numpad-btn flex w-full items-center justify-center rounded-[14px] bg-[var(--bg-elevated)] font-semibold text-[var(--text-1)] ${compact ? 'h-[52px] text-[18px]' : 'h-[60px] text-[20px]'}`}
                            >
                              {key === 'back' ? '⌫' : key}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}

                    {step === 1 ? (
                      <motion.div
                        key="description-step"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-5"
                      >
                        <div className="text-center">
                          <p className="text-[13px] text-[var(--text-2)]">What was it for?</p>
                        </div>

                        <input
                          ref={descriptionRef}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          placeholder="Coffee, groceries, taxi..."
                          className="h-12 w-full rounded-[14px] border border-[var(--border-md)] bg-[var(--bg-elevated)] px-4 text-[16px] text-[var(--text-1)] outline-none transition-colors focus:border-[var(--accent)]"
                        />
                      </motion.div>
                    ) : null}

                    {step === 2 ? (
                      <motion.div
                        key="category-step"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-5"
                      >
                        <div className="text-center">
                          <p className="text-[13px] text-[var(--text-2)]">Pick a category</p>
                        </div>

                        {categories.length > 0 ? (
                          <div className="space-y-4">
                            <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3'}`}>
                            {categories.map((category) => {
                              const color = category.color ?? getCategoryColor(category.name);
                              const selected = category.id === categoryId;
                              return (
                                <motion.button
                                  key={category.id}
                                  type="button"
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => setCategoryId(category.id)}
                                  className="rounded-[14px] border px-3 py-3 text-left transition-colors"
                                  style={{
                                    backgroundColor: selected ? color : withAlpha(color, 0.15),
                                    borderColor: color,
                                    color: selected ? '#FFFFFF' : 'var(--text-1)',
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: selected ? 'rgba(255,255,255,0.92)' : color }}
                                      />
                                  <span className={`truncate font-medium ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
                                        {formatCategory(category.name)}
                                      </span>
                                    </div>
                                    {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                                  </div>
                                </motion.button>
                              );
                            })}
                            </div>

                            {groups.length > 0 ? (
                              <div className="rounded-[14px] border border-[var(--border-md)] bg-[var(--bg-elevated)] px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-2)]">Share with group</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {groups.map((group) => {
                                    const selected = group.id === groupId;
                                    return (
                                      <motion.button
                                        key={group.id}
                                        type="button"
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setGroupId(selected ? null : group.id)}
                                        className="min-h-11 rounded-full border px-3 py-2 text-[12px] font-medium"
                                        style={{
                                          borderColor: selected ? 'var(--accent)' : 'var(--border-md)',
                                          backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg-card)',
                                          color: selected ? 'var(--accent)' : 'var(--text-1)',
                                        }}
                                      >
                                        {group.name}
                                      </motion.button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-[16px] border border-dashed border-[var(--border-md)] bg-[var(--bg-elevated)] px-4 py-5 text-center text-sm text-[var(--text-2)]">
                            <p>No categories. Add one in Profile to finish Quick Add.</p>
                            {onOpenProfile ? (
                              <button
                                type="button"
                                onClick={onOpenProfile}
                                className="mt-4 text-sm font-semibold text-[var(--accent)]"
                              >
                                Open Profile
                              </button>
                            ) : null}
                          </div>
                        )}

                        {selectedCategory ? (
                          <div className="rounded-[16px] border border-[var(--border-md)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-2)]">
                            Saving to <span className="font-semibold text-[var(--text-1)]">{formatCategory(selectedCategory.name)}</span>
                          </div>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handlePrimaryAction()}
                  disabled={!canContinue || isSaving}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-[14px] text-sm font-semibold text-white transition-opacity ${
                    step === 2 ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'
                  } ${compact ? 'h-11' : 'h-12'} ${!canContinue || isSaving ? 'opacity-50' : ''}`}
                >
                  {isSaving ? 'Saving...' : step === 2 ? 'Add expense' : 'Next'}
                  {!isSaving && step < 2 ? <ChevronRight className="h-4 w-4" /> : null}
                </motion.button>
              </div>
            </div>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}
