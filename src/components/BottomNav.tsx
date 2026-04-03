import React from 'react';
import type { ScreenKey } from './shell';
import { TabRail } from './shell';

export interface BottomNavProps {
  currentScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
  onPrimaryAction: () => void;
  onPrimaryActionLongPress?: () => void;
}

export default function BottomNav({ currentScreen, onNavigate, onPrimaryAction, onPrimaryActionLongPress }: BottomNavProps) {
  const items: Array<{ key: ScreenKey; label: string; icon: string }> = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    { key: 'history', label: 'History', icon: 'receipt_long' },
    { key: 'analysis', label: 'Analysis', icon: 'bar_chart' },
    { key: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <TabRail
      current={currentScreen}
      items={items}
      onNavigate={onNavigate}
      onPrimaryAction={onPrimaryAction}
      onPrimaryActionLongPress={onPrimaryActionLongPress}
    />
  );
}
