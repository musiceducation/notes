/**
 * Bundled for www/capacitor-native.js — StatusBar + SplashScreen on native only.
 * Exposes window.__notesSpriteNative for Cap-aware fullscreen / immersive chrome.
 */
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

async function setImmersive(on) {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    if (on) await StatusBar.hide();
    else {
      await StatusBar.show();
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Light });
    }
    return true;
  } catch (e) {
    console.warn("[capacitor-native] setImmersive", e);
    return false;
  }
}

async function init() {
  if (typeof window !== "undefined") {
    window.__notesSpriteNative = {
      isNative: Capacitor.isNativePlatform(),
      setImmersive,
    };
  }
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#6B4ED4" });
  } catch (e) {
    console.warn("[capacitor-native] StatusBar", e);
  }
  const hideSplash = async () => {
    try {
      await SplashScreen.hide({ fadeOutDuration: 280 });
    } catch (e) {
      console.warn("[capacitor-native] SplashScreen", e);
    }
  };
  if (document.readyState === "complete") await hideSplash();
  else
    window.addEventListener("load", () => {
      void hideSplash();
    });
}

void init();
