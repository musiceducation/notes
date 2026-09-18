import type { CapacitorConfig } from '@capacitor/core';

/**
 * 音符小精靈 / Music Adventure — Capacitor shell config.
 * Orientation default (Portrait) is enforced in iOS Info.plist after `npx cap add ios`
 * (UISupportedInterfaceOrientations = Portrait only). Capacitor config cannot lock orientation alone.
 * WKWebView bounces are already disabled by Capacitor; scrollEnabled:false also hides rubber-band scroll.
 */
const config: CapacitorConfig = {
  appId: 'com.notessprite.musicapp',
  appName: 'Music Adventure',
  webDir: 'www',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#6B4ED4',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com'],
    },
  },
};

export default config;
