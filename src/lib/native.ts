import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export { ImpactStyle };

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function haptic(style: ImpactStyle) {
  if (!isNativeApp()) {
    return;
  }

  await Haptics.impact({ style }).catch(() => {});
}
