import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronRight, Download, Mail, Palette, Plus, RefreshCw, Smartphone, Tags, TriangleAlert, Upload, User as UserIcon, UsersRound, Wallet, Watch, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Budget, Category, CurrencyCode, Group, ThemeMode, User, UserPreferences } from '../types';
import {
  EmptyState,
  PageShell,
  StyledMonthField,
  UserAvatar,
  getUserInitials,
  prettyCurrency,
} from '../components/shell';
import CustomSelect from '../components/ui/CustomSelect';
import { CATEGORY_ICON_OPTIONS, formatCategory, getCategoryIcon } from '../components/ui/categoryIcons';
import {
  buildBudgetInput,
  buildCategoryInput,
  createBudgetDraft,
  createCategoryDraft,
  getBudgetMonthLabel,
  listCategoryPalette,
  validateBudgetDraft,
  validateCategoryDraft,
} from '../features';
import { apiClient } from '../api';
import { CURRENCIES } from '../constants/currencies';
import { applyResolvedTheme, getStoredThemePreference, resolveThemePreference } from '../lib/theme';
import { getCategoryColor, withAlpha } from '../lib/ui';
import { normalizeImageFile } from '../utils/imageUtils';

const dateFormatOptions = ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'];
const currencySelectOptions = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.name} (${currency.symbol})`,
}));
const dateFormatSelectOptions = dateFormatOptions.map((value) => ({ value, label: value }));
const themeSelectOptions = [
  { value: 'system', label: '💻 Match system' },
  { value: 'dark', label: '🌙 Always dark' },
  { value: 'light', label: '☀️ Always light' },
];

async function resizeAvatarFile(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Could not load the selected image.'));
      nextImage.src = imageUrl;
    });

    const scale = Math.min(1, 400 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare the image for upload.');
    }

    context.drawImage(image, 0, 0, width, height);

    const nextType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
    const extension = nextType === 'image/png' ? 'png' : nextType === 'image/webp' ? 'webp' : 'jpg';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }

        reject(new Error('Could not compress the selected image.'));
      }, nextType, 0.82);
    });

    return new File([blob], `avatar.${extension}`, {
      type: nextType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function cropAvatarFile(
  file: File,
  crop: { x: number; y: number; scale: number },
  source: { width: number; height: number },
) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Could not load the selected image.'));
      nextImage.src = imageUrl;
    });

    const size = 400;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare the cropped image.');
    }

    const scaledWidth = source.width * crop.scale;
    const scaledHeight = source.height * crop.scale;
    const maxOffsetX = Math.max(0, (scaledWidth - size) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - size) / 2);
    const clampedX = Math.min(maxOffsetX, Math.max(-maxOffsetX, crop.x));
    const clampedY = Math.min(maxOffsetY, Math.max(-maxOffsetY, crop.y));
    const drawX = (size - scaledWidth) / 2 + clampedX;
    const drawY = (size - scaledHeight) / 2 + clampedY;

    context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

    const nextType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
    const extension = nextType === 'image/png' ? 'png' : nextType === 'image/webp' ? 'webp' : 'jpg';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }

        reject(new Error('Could not create the cropped image.'));
      }, nextType, 0.9);
    });

    return new File([blob], `avatar-cropped.${extension}`, {
      type: nextType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function createFileFromImageUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not load the current profile image.');
  }

  const blob = await response.blob();
  const extension =
    blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'jpg';

  return new File([blob], `avatar-source.${extension}`, {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now(),
  });
}

function SettingsRow({
  icon,
  label,
  value,
  children,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="settings-row flex min-h-[52px] w-full items-center gap-3 border-b border-outline/10 py-3 text-left last:border-b-0"
    >
      <span className="text-on-surface-variant">{icon}</span>
      <span className={`flex-1 text-sm font-medium ${tone === 'danger' ? 'text-error' : 'text-on-surface'}`}>{label}</span>
      {children ?? <span className="settings-row-value text-sm text-on-surface-variant">{value}</span>}
      <ChevronRight className="h-4 w-4 text-outline" />
    </button>
  );
}

export interface ProfileViewProps {
  user?: User | null;
  preferences?: UserPreferences | null;
  categories?: Category[];
  budgets?: Budget[];
  groups?: Group[];
  monthlyIncome?: number;
  expenseCount?: number;
  isLoading?: boolean;
  headerAccessory?: React.ReactNode;
  isSavingPreferences?: boolean;
  isSavingProfile?: boolean;
  isSavingCategory?: boolean;
  isSavingBudget?: boolean;
  isUploadingAvatar?: boolean;
  onSignOut?: () => void;
  onSavePreferences?: (preferences: UserPreferences) => void | Promise<void>;
  onSaveProfile?: (input: { avatarUrl?: string | null }) => void | Promise<void>;
  onUploadAvatar?: (file: File) => Promise<string>;
  onCreateCategory?: (input: ReturnType<typeof buildCategoryInput>) => void | Promise<void>;
  onUpdateCategory?: (categoryId: string, input: ReturnType<typeof buildCategoryInput>) => void | Promise<void>;
  onDeleteCategory?: (categoryId: string) => void | Promise<void>;
  onCreateBudget?: (input: ReturnType<typeof buildBudgetInput>) => void | Promise<void>;
  onUpdateBudget?: (budgetId: string, input: ReturnType<typeof buildBudgetInput>) => void | Promise<void>;
  onDeleteBudget?: (budgetId: string) => void | Promise<void>;
  onCreateGroup?: (name: string) => void | Promise<void>;
  onInviteGroupMember?: (groupId: string, email: string) => void | Promise<void>;
  onOpenGroup?: (groupId: string) => void;
}

export default function ProfileView({
  user,
  preferences,
  categories = [],
  budgets = [],
  groups = [],
  monthlyIncome,
  expenseCount = 0,
  isLoading = false,
  headerAccessory,
  isSavingPreferences = false,
  isSavingProfile = false,
  isSavingCategory = false,
  isSavingBudget = false,
  isUploadingAvatar = false,
  onSignOut,
  onSavePreferences,
  onSaveProfile,
  onUploadAvatar,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateBudget,
  onUpdateBudget,
  onDeleteBudget,
  onCreateGroup,
  onInviteGroupMember,
  onOpenGroup,
}: ProfileViewProps = {}) {
  const [currency, setCurrency] = useState<UserPreferences['currency']>(preferences?.currency ?? 'USD');
  const [dateFormat, setDateFormat] = useState(preferences?.dateFormat ?? 'MM/dd/yyyy');
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(preferences?.defaultCategoryId ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [themePreference, setThemePreference] = useState(getStoredThemePreference());
  const [categoryDraft, setCategoryDraft] = useState(createCategoryDraft());
  const [budgetDraft, setBudgetDraft] = useState(createBudgetDraft(undefined, { currency: preferences?.currency }));
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState('');
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarEditorUrl, setAvatarEditorUrl] = useState<string | null>(null);
  const [avatarEditorFile, setAvatarEditorFile] = useState<File | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarImageSize, setAvatarImageSize] = useState({ width: 400, height: 400 });
  const [workspaceActionMessage, setWorkspaceActionMessage] = useState<string | null>(null);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [inviteEmailDraft, setInviteEmailDraft] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const avatarDragRef = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);
  const avatarPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryPalette = useMemo(() => listCategoryPalette(), []);
  const categorySelectOptions = useMemo(
    () => categories.map((category) => ({ value: category.id, label: formatCategory(category.name) })),
    [categories],
  );

  useEffect(() => {
    setCurrency(preferences?.currency ?? 'USD');
    setDateFormat(preferences?.dateFormat ?? 'MM/dd/yyyy');
    setDefaultCategoryId(preferences?.defaultCategoryId ?? null);
    setBudgetDraft((current) => ({ ...current, currency: preferences?.currency ?? current.currency }));
  }, [preferences]);

  useEffect(() => {
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user]);

  const preferencesDirty =
    currency !== (preferences?.currency ?? 'USD') ||
    dateFormat !== (preferences?.dateFormat ?? 'MM/dd/yyyy') ||
    defaultCategoryId !== (preferences?.defaultCategoryId ?? null);
  const profileDirty = avatarUrl !== (user?.avatarUrl ?? null);

  const resetCategoryDraft = () => {
    setActiveCategoryId(null);
    setCategoryDraft(createCategoryDraft());
  };

  const resetBudgetDraft = () => {
    setActiveBudgetId(null);
    setBudgetDraft(createBudgetDraft(undefined, { currency }));
  };

  const handleSavePreferences = async () => {
    if (!preferencesDirty) {
      return;
    }

    await onSavePreferences?.({
      currency,
      dateFormat,
      defaultCategoryId,
      theme: preferences?.theme ?? 'system',
    });
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadAvatar) {
      return;
    }

    setAvatarUploadError(null);
    setAvatarMenuOpen(false);
    setAvatarUploadStatus('Converting image...');

    try {
      const normalizedFile = await normalizeImageFile(file);
      openAvatarEditor(normalizedFile);
    } catch (error) {
      setAvatarUploadError(error instanceof Error ? error.message : 'Could not upload the selected image.');
    } finally {
      setAvatarUploadStatus('');
      event.target.value = '';
    }
  };

  const closeAvatarEditor = () => {
    if (avatarEditorUrl) {
      URL.revokeObjectURL(avatarEditorUrl);
    }
    setAvatarEditorOpen(false);
    setAvatarEditorUrl(null);
    setAvatarEditorFile(null);
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarZoom(1);
    setAvatarImageSize({ width: 400, height: 400 });
  };

  const openAvatarEditor = (file: File) => {
    const nextUrl = URL.createObjectURL(file);
    if (avatarEditorUrl) {
      URL.revokeObjectURL(avatarEditorUrl);
    }
    setAvatarEditorFile(file);
    setAvatarEditorUrl(nextUrl);
    setAvatarCrop({ x: 0, y: 0 });
    setAvatarZoom(1);
    setAvatarImageSize({ width: 400, height: 400 });
    setAvatarEditorOpen(true);
  };

  const handleConfirmAvatarCrop = async () => {
    if (!avatarEditorFile || !onUploadAvatar) {
      return;
    }

    setAvatarUploadError(null);
    setAvatarUploadStatus('Preparing image...');

    try {
      const croppedFile = await cropAvatarFile(
        avatarEditorFile,
        { x: avatarCrop.x, y: avatarCrop.y, scale: avatarZoom },
        avatarImageSize,
      );
      const resizedFile = await resizeAvatarFile(croppedFile);
      setAvatarUploadStatus('Uploading...');
      const uploadedUrl = await onUploadAvatar(resizedFile);
      setAvatarUrl(uploadedUrl);
      closeAvatarEditor();
    } catch (error) {
      setAvatarUploadError(error instanceof Error ? error.message : 'Could not upload the selected image.');
    } finally {
      setAvatarUploadStatus('');
    }
  };

  const handleEditCurrentAvatar = async () => {
    if (!avatarUrl) {
      return;
    }

    setAvatarMenuOpen(false);
    setAvatarUploadError(null);
    setAvatarUploadStatus('Preparing image...');

    try {
      const sourceFile = await createFileFromImageUrl(avatarUrl);
      openAvatarEditor(sourceFile);
    } catch (error) {
      setAvatarUploadError(error instanceof Error ? error.message : 'Could not load the current profile image.');
    } finally {
      setAvatarUploadStatus('');
    }
  };

  const getAvatarCropBounds = (zoom = avatarZoom, size = avatarImageSize) => {
    const frame = 280;
    const scaledWidth = size.width * zoom;
    const scaledHeight = size.height * zoom;
    return {
      maxX: Math.max(0, (scaledWidth - frame) / 2),
      maxY: Math.max(0, (scaledHeight - frame) / 2),
    };
  };

  const clampAvatarCrop = (next: { x: number; y: number }, zoom = avatarZoom, size = avatarImageSize) => {
    const bounds = getAvatarCropBounds(zoom, size);
    return {
      x: Math.min(bounds.maxX, Math.max(-bounds.maxX, next.x)),
      y: Math.min(bounds.maxY, Math.max(-bounds.maxY, next.y)),
    };
  };

  const beginAvatarDrag = (clientX: number, clientY: number) => {
    avatarDragRef.current = { x: clientX, y: clientY, cropX: avatarCrop.x, cropY: avatarCrop.y };
  };

  const moveAvatarDrag = (clientX: number, clientY: number) => {
    if (!avatarDragRef.current) {
      return;
    }

    const deltaX = clientX - avatarDragRef.current.x;
    const deltaY = clientY - avatarDragRef.current.y;
    setAvatarCrop(clampAvatarCrop({ x: avatarDragRef.current.cropX + deltaX, y: avatarDragRef.current.cropY + deltaY }));
  };

  const endAvatarDrag = () => {
    avatarDragRef.current = null;
  };

  const updateAvatarZoom = (nextZoom: number) => {
    setAvatarZoom(Math.min(2.6, Math.max(1, nextZoom)));
  };

  const getTouchDistance = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) {
      return 0;
    }

    const first = touches[0];
    const second = touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  const handleAvatarTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      beginAvatarDrag(touch.clientX, touch.clientY);
      avatarPinchRef.current = null;
      return;
    }

    if (event.touches.length >= 2) {
      endAvatarDrag();
      avatarPinchRef.current = {
        distance: getTouchDistance(event.touches),
        zoom: avatarZoom,
      };
    }
  };

  const handleAvatarTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1 && avatarDragRef.current) {
      event.preventDefault();
      const touch = event.touches[0];
      moveAvatarDrag(touch.clientX, touch.clientY);
      return;
    }

    if (event.touches.length >= 2 && avatarPinchRef.current) {
      event.preventDefault();
      const nextDistance = getTouchDistance(event.touches);
      if (!avatarPinchRef.current.distance) {
        return;
      }

      const zoomRatio = nextDistance / avatarPinchRef.current.distance;
      updateAvatarZoom(avatarPinchRef.current.zoom * zoomRatio);
    }
  };

  const handleAvatarTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
      endAvatarDrag();
      avatarPinchRef.current = null;
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      beginAvatarDrag(touch.clientX, touch.clientY);
      avatarPinchRef.current = null;
    }
  };

  useEffect(() => {
    if (!avatarEditorOpen) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => moveAvatarDrag(event.clientX, event.clientY);
    const handlePointerUp = () => endAvatarDrag();

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [avatarEditorOpen, avatarCrop, avatarZoom, avatarImageSize]);

  useEffect(() => {
    setAvatarCrop((current) => clampAvatarCrop(current));
  }, [avatarZoom, avatarImageSize]);

  useEffect(() => {
    if (!avatarMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (avatarMenuRef.current && target && !avatarMenuRef.current.contains(target)) {
        setAvatarMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [avatarMenuOpen]);

  useEffect(() => () => {
    if (avatarEditorUrl) {
      URL.revokeObjectURL(avatarEditorUrl);
    }
  }, [avatarEditorUrl]);

  const handleSaveProfile = async () => {
    await onSaveProfile?.({
      avatarUrl,
    });
  };

  const clearWorkspaceFeedback = () => {
    setWorkspaceActionMessage(null);
    setWorkspaceActionError(null);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    clearWorkspaceFeedback();
    try {
      const blob = await apiClient.reports.exportExpensesCsv();
      downloadBlob(blob, 'expenses.csv');
      setWorkspaceActionMessage('CSV export is ready.');
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : 'Could not export CSV.');
    }
  };

  const handleExportBackup = async () => {
    clearWorkspaceFeedback();
    try {
      const payload = await apiClient.workspace.exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setWorkspaceActionMessage('JSON backup exported.');
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : 'Could not create a backup.');
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    clearWorkspaceFeedback();
    setIsRestoringBackup(true);

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      await apiClient.workspace.restoreBackup(parsed);
      window.location.reload();
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : 'Could not restore this backup.');
    } finally {
      setIsRestoringBackup(false);
      event.target.value = '';
    }
  };

  const handleEditCategory = (category: Category) => {
    setActiveCategoryId(category.id);
    setCategoryDraft(createCategoryDraft(category));
  };

  const handleSubmitCategory = async () => {
    const errors = validateCategoryDraft(categoryDraft);
    if (errors.name || errors.color || errors.icon) {
      return;
    }

    const input = buildCategoryInput(categoryDraft);
    if (activeCategoryId) {
      await onUpdateCategory?.(activeCategoryId, input);
    } else {
      await onCreateCategory?.(input);
    }
    resetCategoryDraft();
  };

  const handleEditBudget = (budget: Budget) => {
    setActiveBudgetId(budget.id);
    setBudgetDraft(createBudgetDraft(budget, { currency }));
  };

  const handleSubmitBudget = async () => {
    const errors = validateBudgetDraft(budgetDraft);
    if (errors.month || errors.amount || errors.currency) {
      return;
    }

    const input = buildBudgetInput(budgetDraft);
    if (activeBudgetId) {
      await onUpdateBudget?.(activeBudgetId, input);
    } else {
      await onCreateBudget?.(input);
    }
    resetBudgetDraft();
  };

  const handleCreateGroup = async () => {
    const name = groupNameDraft.trim();
    if (!name) {
      return;
    }

    await onCreateGroup?.(name);
    setGroupNameDraft('');
  };

  const handleInviteGroupMember = async (groupId: string) => {
    const email = inviteEmailDraft.trim();
    if (!email) {
      return;
    }

    await onInviteGroupMember?.(groupId, email);
    setInviteEmailDraft('');
    setInviteGroupId(null);
  };

  return (
    <PageShell
      title="Profile"
      subtitle="Account details, preferences, appearance, and budget setup."
      headerAccessory={headerAccessory}
    >
      {avatarEditorOpen && avatarEditorUrl ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="surface-card w-full max-w-md rounded-[28px] p-5 shadow-[var(--shadow-lg)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Profile photo</p>
                <h3 className="mt-1 text-lg font-semibold text-on-surface">Crop and position</h3>
              </div>
              <button
                type="button"
                onClick={closeAvatarEditor}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
                aria-label="Close avatar editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-auto flex w-full max-w-[280px] flex-col items-center">
              <div
                className="relative h-[280px] w-[280px] overflow-hidden rounded-full border border-outline/15 bg-[var(--bg-elevated)]"
                onPointerDown={(event) => beginAvatarDrag(event.clientX, event.clientY)}
                onWheel={(event) => {
                  event.preventDefault();
                  updateAvatarZoom(avatarZoom - event.deltaY * 0.0015);
                }}
                onTouchStart={handleAvatarTouchStart}
                onTouchMove={handleAvatarTouchMove}
                onTouchEnd={handleAvatarTouchEnd}
                style={{ touchAction: 'none' }}
              >
                <img
                  src={avatarEditorUrl}
                  alt="Crop preview"
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  draggable={false}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    const baseScale = Math.max(280 / img.naturalWidth, 280 / img.naturalHeight);
                    setAvatarImageSize({
                      width: img.naturalWidth * baseScale,
                      height: img.naturalHeight * baseScale,
                    });
                  }}
                  style={{
                    width: `${avatarImageSize.width}px`,
                    height: `${avatarImageSize.height}px`,
                    transform: `translate(calc(-50% + ${avatarCrop.x}px), calc(-50% + ${avatarCrop.y}px)) scale(${avatarZoom})`,
                    transformOrigin: 'center center',
                    touchAction: 'none',
                  }}
                />
              </div>
              <p className="mt-3 text-[12px] text-on-surface-variant">Drag to reposition. Pinch on touchscreens or use the mouse wheel to zoom.</p>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={closeAvatarEditor} className="ui-btn ui-btn-secondary h-11 flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAvatarCrop()}
                disabled={Boolean(avatarUploadStatus) || isUploadingAvatar}
                className="ui-btn ui-btn-primary h-11 flex-1 disabled:opacity-60"
              >
                {avatarUploadStatus || (isUploadingAvatar ? 'Saving…' : 'Use photo')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="avatar-section surface-card rounded-[var(--radius-lg)] px-5 py-8 text-center">
        {isLoading ? (
          <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-surface-container" />
        ) : (
          <>
            <input ref={avatarInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(event) => void handleAvatarChange(event)} />
            <div ref={avatarMenuRef} className="relative mx-auto w-fit">
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((current) => !current)}
                disabled={Boolean(avatarUploadStatus) || isUploadingAvatar}
                className="group rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Profile photo options"
              >
                <div className="rounded-full border-[3px] border-[var(--bg-card)] p-[2px] transition-transform group-hover:scale-[1.02]" style={{ boxShadow: '0 0 0 2px var(--accent)' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user?.name ? `${user.name} profile` : 'Profile'} className="h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
                      {getUserInitials(user)}
                    </div>
                  )}
                </div>
              </button>
              {avatarMenuOpen ? (
                <div className="absolute left-1/2 top-[calc(100%+12px)] z-20 min-w-[190px] -translate-x-1/2 overflow-hidden rounded-[16px] border border-outline/10 bg-[var(--bg-card)] p-1 text-left shadow-[var(--shadow-md)]">
                  <button
                    type="button"
                    onClick={() => void handleEditCurrentAvatar()}
                    disabled={!avatarUrl}
                    className="flex w-full items-center rounded-[12px] px-3 py-2 text-sm font-medium text-on-surface transition hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Edit image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      avatarInputRef.current?.click();
                    }}
                    className="flex w-full items-center rounded-[12px] px-3 py-2 text-sm font-medium text-on-surface transition hover:bg-[var(--bg-elevated)]"
                  >
                    Replace image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarMenuOpen(false);
                      setAvatarUploadError(null);
                      setAvatarUrl(null);
                    }}
                    disabled={!avatarUrl}
                    className="mt-1 flex w-full items-center rounded-[12px] px-3 py-2 text-sm font-medium text-error transition hover:bg-[var(--red-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete image
                  </button>
                </div>
              ) : null}
            </div>
            {avatarUploadStatus ? (
              <p className="mt-2 inline-flex items-center gap-2 text-[12px] text-[var(--text-2)]">
                <RefreshCw className="h-[14px] w-[14px] animate-spin" />
                {avatarUploadStatus}
              </p>
            ) : null}
            {avatarUploadError ? <p className="mt-2 text-[12px] text-error">{avatarUploadError}</p> : null}
            <h2 className="mt-4 text-xl font-bold tracking-[-0.03em] text-on-surface">{user?.name ?? 'Your profile'}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {user?.email ?? 'Signed in with a synced account and cached offline on this device.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {profileDirty && (
                <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={() => void handleSaveProfile()} className="ui-btn ui-btn-primary h-11">
                  {isSavingProfile ? 'Saving…' : 'Save profile'}
                </motion.button>
              )}
            </div>
          </>
        )}
      </section>

      <div className="profile-two-col profile-grid grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="surface-card rounded-[var(--radius-md)] p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Account</p>
          <SettingsRow icon={<UserIcon className="h-5 w-5" />} label="Name" value={user?.name ?? 'Not available'} />
          <SettingsRow icon={<Mail className="h-5 w-5" />} label="Email" value={user?.email ?? 'Not available'} />
          <SettingsRow icon={<CalendarDays className="h-5 w-5" />} label="Joined" value={user ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(user.createdAt)) : '—'} />
        </section>

        <section className="surface-card rounded-[var(--radius-md)] p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Preferences</p>
          <div className="space-y-3">
            <label className="block">
              <div className="mb-2 flex items-center gap-3 text-sm font-medium text-on-surface">
                <Wallet className="h-5 w-5 text-on-surface-variant" />
                Currency
              </div>
              <CustomSelect value={currency} onChange={(value) => setCurrency(value as UserPreferences['currency'])} options={currencySelectOptions} className="w-full" />
              <p className="mt-3 text-[12px] text-on-surface-variant">
                Multi-currency entry stays available, but this local-first build keeps amounts exactly as entered and does not fetch live rates.
              </p>
            </label>
            <label className="block">
              <div className="mb-2 flex items-center gap-3 text-sm font-medium text-on-surface">
                <CalendarDays className="h-5 w-5 text-on-surface-variant" />
                Date format
              </div>
              <CustomSelect value={dateFormat} onChange={setDateFormat} options={dateFormatSelectOptions} className="w-full" />
            </label>
            <label className="block">
              <div className="mb-2 flex items-center gap-3 text-sm font-medium text-on-surface">
                <Tags className="h-5 w-5 text-on-surface-variant" />
                Default category
              </div>
              <CustomSelect
                value={defaultCategoryId ?? ''}
                onChange={(value) => setDefaultCategoryId(value || null)}
                options={[{ value: '', label: 'No default category' }, ...categorySelectOptions]}
                className="w-full"
              />
            </label>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={() => void handleSavePreferences()} disabled={isSavingPreferences || !preferencesDirty} className="ui-btn ui-btn-primary mt-4 h-11 disabled:opacity-50">
            {isSavingPreferences ? 'Saving…' : 'Save preferences'}
          </motion.button>
        </section>
      </div>

      <div className="profile-two-col profile-grid grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="surface-card rounded-[var(--radius-md)] p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Appearance</p>
          <label className="block">
            <div className="mb-2 flex items-center gap-3 text-sm font-medium text-on-surface">
              <Palette className="h-5 w-5 text-on-surface-variant" />
              Theme
            </div>
            <CustomSelect
              value={themePreference}
              onChange={(value) => {
                const nextTheme = value as ThemeMode;
                setThemePreference(nextTheme);
                window.localStorage.setItem('theme-preference', nextTheme);
                applyResolvedTheme(resolveThemePreference(nextTheme));
              }}
              options={themeSelectOptions}
              className="w-full"
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-sm)] border border-outline/10 bg-surface-container-low px-4 py-3">
              <p className="text-[12px] uppercase tracking-[0.22em] text-on-surface-variant">Tracked expenses</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">{expenseCount}</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-outline/10 bg-surface-container-low px-4 py-3">
              <p className="text-[12px] uppercase tracking-[0.22em] text-on-surface-variant">Monthly income</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">{monthlyIncome !== undefined ? prettyCurrency(monthlyIncome, preferences?.currency ?? 'USD') : 'Not set'}</p>
            </div>
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-md)] p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Danger zone</p>
          <SettingsRow icon={<TriangleAlert className="h-5 w-5" />} label="Sign out" value="Remove this device session" tone="danger" onClick={onSignOut} />
        </section>
      </div>

      <div className="profile-two-col profile-grid grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="surface-card rounded-[var(--radius-md)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-on-surface">Categories</p>
              <p className="mt-1 text-sm text-on-surface-variant">Create, recolor, and rename your custom categories.</p>
            </div>
          </div>

          <div className="profile-form-row grid gap-3 md:grid-cols-2">
            <input value={categoryDraft.name} onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Category name" className="input-shell" />
            <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Icon</p>
              <div className="grid grid-cols-5 gap-2">
                {CATEGORY_ICON_OPTIONS.map((choice) => {
                  const Icon = choice.Icon;
                  const active = categoryDraft.icon.trim().toLowerCase().replaceAll('_', '-') === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setCategoryDraft((current) => ({ ...current, icon: choice.value }))}
                      className="flex h-11 items-center justify-center rounded-[var(--radius-sm)] border transition-colors"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--border-md)',
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-card)',
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                      }}
                      aria-label={choice.label}
                      title={choice.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="color-swatches mt-3 flex flex-wrap gap-2">
            {categoryPalette.map((choice) => (
              <button
                key={choice.color}
                type="button"
                onClick={() => setCategoryDraft((current) => ({ ...current, color: choice.color }))}
                className="h-9 w-9 rounded-full border-2"
                style={{ backgroundColor: choice.color, borderColor: categoryDraft.color === choice.color ? 'var(--text-1)' : 'transparent' }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={() => void handleSubmitCategory()} disabled={isSavingCategory} className="ui-btn ui-btn-primary h-11">
              {activeCategoryId ? 'Update category' : 'Create category'}
            </motion.button>
            {activeCategoryId && (
              <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={resetCategoryDraft} className="ui-btn ui-btn-secondary h-11">
                Cancel
              </motion.button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {categories.length === 0 ? (
              <EmptyState icon="category" title="No categories yet" description="Create categories for food, travel, subscriptions, and anything else you track." />
            ) : (
              categories.map((category) => {
                const color = getCategoryColor(category.name);
                const normalizedIcon = category.icon.trim().toLowerCase().replaceAll('_', '-');
                return (
                  <div key={category.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-outline/10 bg-surface-container-low px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: withAlpha(color, 0.18), color }}>
                        {React.createElement(getCategoryIcon(category.icon), { className: 'h-4 w-4' })}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{formatCategory(category.name)}</p>
                        <p className="text-xs text-on-surface-variant">{CATEGORY_ICON_OPTIONS.find((choice) => choice.value === normalizedIcon)?.label ?? 'Category icon'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEditCategory(category)} className="rounded-full px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Edit</button>
                      <button type="button" onClick={() => void onDeleteCategory?.(category.id)} className="rounded-full px-3 py-2 text-xs font-semibold text-error hover:bg-error/10">Delete</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="surface-card rounded-[var(--radius-md)] p-4">
          <div className="mb-4">
            <p className="text-base font-semibold text-on-surface">Budgets</p>
            <p className="mt-1 text-sm text-on-surface-variant">Monthly limits for overall or category-specific spending.</p>
          </div>

          <div className="profile-form-row grid gap-3">
            <CustomSelect
              value={budgetDraft.categoryId ?? ''}
              onChange={(value) => setBudgetDraft((current) => ({ ...current, categoryId: value || null }))}
              options={[{ value: '', label: 'Overall budget' }, ...categorySelectOptions]}
              className="w-full"
            />
            <StyledMonthField value={budgetDraft.month} onChange={(value) => setBudgetDraft((current) => ({ ...current, month: value }))} />
            <input type="number" value={budgetDraft.amount} onChange={(event) => setBudgetDraft((current) => ({ ...current, amount: event.target.value }))} className="input-shell" placeholder="Budget amount" />
            <CustomSelect
              value={budgetDraft.currency}
              onChange={(value) => setBudgetDraft((current) => ({ ...current, currency: value as CurrencyCode }))}
              options={currencySelectOptions}
              className="w-full"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={() => void handleSubmitBudget()} disabled={isSavingBudget} className="ui-btn ui-btn-primary h-11">
              {activeBudgetId ? 'Update budget' : 'Create budget'}
            </motion.button>
            {activeBudgetId && (
              <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={resetBudgetDraft} className="ui-btn ui-btn-secondary h-11">
                Cancel
              </motion.button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {budgets.length === 0 ? (
              <EmptyState icon="wallet" title="No budgets configured" description="Create a monthly target to start tracking progress." />
            ) : (
              budgets.map((budget) => {
                const category = categories.find((item) => item.id === budget.categoryId);
                const color = category ? getCategoryColor(category.name) : 'var(--accent)';
                const progress = Math.min(100, (budget.spent / Math.max(budget.amount, 1)) * 100);
                return (
                  <motion.div
                    key={budget.id}
                    whileHover={{ y: -2 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-on-surface">{category ? formatCategory(category.name) : 'Overall budget'}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{getBudgetMonthLabel(budget.month)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-on-surface">{prettyCurrency(budget.spent, budget.currency)}</p>
                        <p className="text-xs text-on-surface-variant">of {prettyCurrency(budget.amount, budget.currency)}</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-surface-container">
                      <div className="h-1.5 rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => handleEditBudget(budget)} className="rounded-full px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Edit</button>
                      <button type="button" onClick={() => void onDeleteBudget?.(budget.id)} className="rounded-full px-3 py-2 text-xs font-semibold text-error hover:bg-error/10">Delete</button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="surface-card rounded-[var(--radius-md)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-2)]">Shared budgets</p>
            <p className="mt-2 text-[13px] text-[var(--text-2)]">
              Split budgets with family or housemates.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={groupNameDraft}
            onChange={(event) => setGroupNameDraft(event.target.value)}
            placeholder="Family budget"
            className="input-shell h-11 flex-1"
          />
          <button type="button" onClick={() => void handleCreateGroup()} className="ui-btn ui-btn-primary h-11 sm:w-auto">
            <Plus className="h-4 w-4" />
            Create group
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius-md)] border border-dashed border-outline/20 bg-surface-container-low px-5 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <UsersRound className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-on-surface">No shared budgets yet</p>
            <p className="mt-2 text-[13px] leading-6 text-on-surface-variant">
              Create one to track spending with family or a partner.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {groups.map((group) => {
              const totalBudget = (group.budgets ?? []).reduce((sum, budget) => sum + budget.amount, 0);
              const totalSpent = (group.budgets ?? []).reduce((sum, budget) => sum + budget.spent, 0);
              const progress = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

              return (
                <div key={group.id} className="rounded-[var(--radius-md)] border border-outline/10 bg-[var(--bg-card-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-on-surface">{group.name}</p>
                      <p className="mt-1 text-[13px] text-on-surface-variant">
                        {(group.members ?? []).length} member{(group.members ?? []).length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex -space-x-2">
                      {(group.members ?? []).slice(0, 3).map((member) => (
                        <UserAvatar
                          key={member.id}
                          user={{ name: member.name ?? member.email ?? 'Member', email: member.email ?? '', avatarUrl: member.avatarUrl ?? null }}
                          className="h-8 w-8 border-2 border-[var(--bg-card-2)] text-[10px]"
                          textClassName="text-[10px]"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(group.budgets ?? []).length === 0 ? (
                      <p className="text-[13px] text-on-surface-variant">No budgets added yet.</p>
                    ) : (
                      (group.budgets ?? []).map((budget) => {
                        const budgetProgress = budget.amount > 0 ? Math.min(100, (budget.spent / budget.amount) * 100) : 0;
                        return (
                          <div key={budget.id} className="rounded-[var(--radius-sm)] bg-[var(--bg-card)] px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-on-surface">{budget.name}</p>
                              <p className="text-xs text-on-surface-variant">
                                {prettyCurrency(budget.spent, budget.currency)} / {prettyCurrency(budget.amount, budget.currency)}
                              </p>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-surface-container">
                              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${budgetProgress}%` }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 h-1.5 rounded-full bg-surface-container">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-[13px] text-on-surface-variant">
                    {prettyCurrency(totalSpent, preferences?.currency ?? 'USD')} of {prettyCurrency(totalBudget, preferences?.currency ?? 'USD')} spent
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpenGroup?.(group.id)} className="ui-btn ui-btn-secondary h-11">
                      View group
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteGroupId((current) => current === group.id ? null : group.id);
                        setInviteEmailDraft('');
                      }}
                      className="rounded-full px-3 py-2 text-[13px] font-semibold text-primary hover:bg-primary/10"
                    >
                      Invite
                    </button>
                  </div>

                  {inviteGroupId === group.id ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={inviteEmailDraft}
                        onChange={(event) => setInviteEmailDraft(event.target.value)}
                        placeholder="name@example.com"
                        className="input-shell h-11 flex-1"
                      />
                      <button type="button" onClick={() => void handleInviteGroupMember(group.id)} className="ui-btn ui-btn-primary h-11 sm:w-auto">
                        Send invite link
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface-card rounded-[var(--radius-md)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-2)]">Data & Backup</p>
            <p className="mt-2 text-[13px] text-[var(--text-2)]">
              Keep a manual backup before changing phones or reinstalling the app.
            </p>
          </div>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleRestoreBackup(event)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleExportCsv()} className="ui-btn ui-btn-secondary h-11">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" onClick={() => void handleExportBackup()} className="ui-btn ui-btn-secondary h-11">
              <Download className="h-4 w-4" />
              Backup JSON
            </button>
            <button type="button" onClick={() => backupInputRef.current?.click()} disabled={isRestoringBackup} className="ui-btn ui-btn-primary h-11">
              <Upload className="h-4 w-4" />
              {isRestoringBackup ? 'Restoring…' : 'Restore backup'}
            </button>
          </div>
        </div>
        {workspaceActionMessage ? <p className="mt-3 text-sm text-[var(--green)]">{workspaceActionMessage}</p> : null}
        {workspaceActionError ? <p className="mt-3 text-sm text-[var(--red)]">{workspaceActionError}</p> : null}
      </section>

      <section className="surface-card rounded-[var(--radius-md)] p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-2)]">Mobile App</p>
          <p className="mt-2 text-[13px] text-[var(--text-2)]">
            This build is mobile-first. Your account syncs through Supabase, with local offline cache on each signed-in device.
          </p>
        </div>

        <div className="profile-two-col profile-grid mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Quick Add shortcut</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Open the fast 3-step expense entry from your phone home screen or app shortcut.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.location.assign('/quick-add')}
                className="ui-btn ui-btn-primary h-11"
              >
                Open Quick Add
              </button>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--accent)]">
                <Watch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Small-screen shortcut</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Use the watch-sized quick entry route for an even faster tiny-screen logging flow.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.location.assign('/watch-add')}
                className="ui-btn ui-btn-secondary h-11"
              >
                Open Watch Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Local storage</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Expenses, budgets, categories, receipts, and reminders are cached locally so the app stays responsive offline.
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Permissions</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Photos are only requested when you choose a receipt or avatar from the system picker.
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-outline/10 bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Android packaging</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Install the PWA directly or wrap it for Play Store delivery using the generated manifest and mobile shortcuts.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
