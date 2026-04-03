import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig & { bundledWebRuntime: boolean } = {
  appId: 'com.prafulreddy.expensetracker',
  appName: 'Expense Tracker',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#0F1117',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0F1117',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#0F1117',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0F1117',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'large',
      spinnerColor: '#2B7FFF',
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0F1117',
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
