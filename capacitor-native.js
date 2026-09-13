/**
 * Dev fallback when opening index.html without `npm run build:www`.
 * The iOS build replaces www/capacitor-native.js with a bundled script (StatusBar + SplashScreen).
 */
(function () {
  if (typeof window === "undefined") return;
  window.__notesSpriteNative = window.__notesSpriteNative || {
    isNative: false,
    setImmersive: async function () { return false; }
  };
})();
