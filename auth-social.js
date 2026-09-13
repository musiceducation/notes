/**
 * Google, Facebook, and Apple sign-in via Firebase Auth (redirect flow, Capacitor-friendly).
 * Depends: firebase-app-compat, firebase-auth-compat, auth-config.js, #socialAuthOverlay in DOM.
 */
(function () {
  window.MUSIC_APP_AUTH_STATE = { required: false, signedIn: true };

  function capNative() {
    try {
      var C = window.Capacitor;
      if (!C || !C.getPlatform) return false;
      return C.getPlatform() !== "web";
    } catch (e) {
      return false;
    }
  }

  var cfg = window.MUSIC_APP_AUTH || {};
  var isNative = capNative();
  var shouldGate =
    cfg.enabled && (cfg.requireOnNativeOnly !== false ? isNative : true);

  if (!shouldGate) {
    return;
  }

  window.MUSIC_APP_AUTH_STATE = { required: true, signedIn: false };

  var overlay = document.getElementById("socialAuthOverlay");
  var misEl = document.getElementById("socialAuthMisconfig");
  var btnBlock = document.getElementById("socialAuthButtons");

  function showOverlay(mode) {
    if (!overlay) return;
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
    if (mode === "misconfig") {
      if (misEl) misEl.hidden = false;
      if (btnBlock) btnBlock.hidden = true;
    } else {
      if (misEl) misEl.hidden = true;
      if (btnBlock) btnBlock.hidden = false;
    }
    document.documentElement.classList.add("social-auth-active");
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("social-auth-active");
  }

  var fb = cfg.firebase;
  if (
    !fb ||
    !fb.apiKey ||
    !fb.authDomain ||
    !fb.projectId ||
    !fb.appId
  ) {
    showOverlay("misconfig");
    return;
  }

  if (typeof firebase === "undefined") {
    console.error("[auth-social] Firebase SDK not loaded");
    showOverlay("misconfig");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(fb);
  }

  var auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  function emitUser(u) {
    window.MUSIC_APP_AUTH_STATE.signedIn = !!u;
    if (u) {
      var detail = {
        displayName:
          u.displayName ||
          (u.email && u.email.split("@")[0]) ||
          "Player",
        email: u.email || "",
        uid: u.uid
      };
      window.__MUSIC_SOCIAL_PENDING = detail;
      try {
        window.dispatchEvent(
          new CustomEvent("musicapp:social-auth", { detail: detail })
        );
      } catch (e) {}
      hideOverlay();
    } else {
      showOverlay("login");
    }
  }

  auth.getRedirectResult().catch(function (e) {
    console.warn("[auth-social] getRedirectResult", e);
  });

  auth.onAuthStateChanged(function (user) {
    emitUser(user);
  });

  window.musicAppSignInGoogle = function () {
    var p = new firebase.auth.GoogleAuthProvider();
    p.addScope("profile");
    auth.signInWithRedirect(p);
  };

  window.musicAppSignInFacebook = function () {
    var p = new firebase.auth.FacebookAuthProvider();
    p.addScope("public_profile");
    auth.signInWithRedirect(p);
  };

  window.musicAppSignInApple = function () {
    var provider = new firebase.auth.OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    auth.signInWithRedirect(provider);
  };

  document.addEventListener("DOMContentLoaded", function () {
    var a = document.getElementById("btnAppleSignIn");
    if (a) {
      if (cfg.appleSignInEnabled === false) a.hidden = true;
      else
        a.addEventListener("click", function () {
          window.musicAppSignInApple();
        });
    }
    var g = document.getElementById("btnGoogleSignIn");
    var f = document.getElementById("btnFacebookSignIn");
    if (g) g.addEventListener("click", function () { window.musicAppSignInGoogle(); });
    if (f) f.addEventListener("click", function () { window.musicAppSignInFacebook(); });
  });
})();
