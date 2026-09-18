/**
 * AppOrientation — Capacitor Screen Orientation helpers.
 * Default: portrait. Composition studio: landscape. Leave studio → portrait.
 * Info.plist / AndroidManifest must allow landscape (plugin locks at runtime).
 */
(function () {
  'use strict';

  function isNative() {
    try {
      var C = window.Capacitor;
      return !!(C && C.isNativePlatform && C.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function plugin() {
    try {
      var C = window.Capacitor;
      if (!C || !C.registerPlugin) return null;
      return C.registerPlugin('ScreenOrientation');
    } catch (e) {
      return null;
    }
  }

  async function lock(orientation) {
    var p = plugin();
    if (p && p.lock) {
      try {
        await p.lock({ orientation: orientation });
        return true;
      } catch (e) {
        console.warn('[AppOrientation] plugin.lock', e);
      }
    }
    // Web / fallback
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock(orientation);
        return true;
      }
    } catch (e) {
      /* browsers often reject without fullscreen */
    }
    return false;
  }

  async function unlock() {
    var p = plugin();
    if (p && p.unlock) {
      try {
        await p.unlock();
        return true;
      } catch (e) {}
    }
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
        return true;
      }
    } catch (e) {}
    return false;
  }

  window.AppOrientation = {
    lockPortrait: function () {
      return lock('portrait');
    },
    lockLandscape: function () {
      return lock('landscape');
    },
    unlock: unlock,
    isNative: isNative
  };

  function lockDefaultPortrait() {
    if (!isNative()) return;
    window.AppOrientation.lockPortrait().catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lockDefaultPortrait);
  } else {
    lockDefaultPortrait();
  }
})();
