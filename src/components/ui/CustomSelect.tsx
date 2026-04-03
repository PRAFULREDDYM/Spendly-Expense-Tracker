import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border-md)] bg-[var(--bg-card)] px-4 text-left text-sm text-[var(--text-1)] shadow-[var(--shadow)] transition-colors hover:border-[var(--accent)]"
      >
        <span className="truncate pr-3">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-[calc(100%+0.5rem)] z-[100] w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-md)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]"
          >
            <div className="max-h-[220px] overflow-y-auto py-1">
              {options.length ? (
                options.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className="flex h-10 w-full items-center justify-between px-4 text-left text-sm text-[var(--text-1)] transition-colors hover:bg-[var(--bg-card)]"
                    >
                      <span className="truncate pr-3">{option.label}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-sm text-[var(--text-2)]">{placeholder}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
