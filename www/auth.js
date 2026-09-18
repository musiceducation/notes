/**
 * MusicAppAuth — vanilla equivalent of a React useAuth hook.
 * Google + Apple via @capacitor-firebase/authentication (native) or Firebase JS (web).
 * Syncs EXP / gameBests to Firestore when signed in.
 *
 * API: window.MusicAppAuth
 *   .user, .signedIn, .signInWithGoogle(), .signInWithApple(), .signOut()
 *   .syncGameData(profile), .pullGameData(), .subscribe(listener)
 */
(function () {
  'use strict';

  var state = {
    user: null,
    signedIn: false,
    required: false,
    ready: false
  };
  var listeners = [];
  var cfg = window.MUSIC_APP_AUTH || {};
  var db = null;
  var auth = null;

  window.MUSIC_APP_AUTH_STATE = { required: false, signedIn: true };

  function isNative() {
    try {
      var C = window.Capacitor;
      return !!(C && C.getPlatform && C.getPlatform() !== 'web');
    } catch (e) {
      return false;
    }
  }

  function shouldGate() {
    return !!(cfg.enabled && (cfg.requireOnNativeOnly !== false ? isNative() : true));
  }

  function notify() {
    window.MUSIC_APP_AUTH_STATE = {
      required: state.required,
      signedIn: state.signedIn
    };
    listeners.forEach(function (fn) {
      try {
        fn(state);
      } catch (e) {}
    });
  }

  function setUser(u) {
    state.user = u
      ? {
          uid: u.uid,
          displayName:
            u.displayName ||
            (u.email && u.email.split('@')[0]) ||
            'Player',
          email: u.email || '',
          photoURL: u.photoURL || ''
        }
      : null;
    state.signedIn = !!u;
    notify();
    if (u) {
      window.__MUSIC_SOCIAL_PENDING = state.user;
      try {
        window.dispatchEvent(
          new CustomEvent('musicapp:social-auth', { detail: state.user })
        );
      } catch (e) {}
      hideOverlay();
      pullGameData().catch(function () {});
    } else if (state.required) {
      showOverlay('login');
    }
  }

  function showOverlay(mode) {
    var overlay = document.getElementById('socialAuthOverlay');
    var misEl = document.getElementById('socialAuthMisconfig');
    var btnBlock = document.getElementById('socialAuthButtons');
    if (!overlay) return;
    overlay.hidden = false;
    overlay.style.display = '';
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    if (mode === 'misconfig') {
      if (misEl) misEl.hidden = false;
      if (btnBlock) btnBlock.hidden = true;
    } else {
      if (misEl) misEl.hidden = true;
      if (btnBlock) btnBlock.hidden = false;
    }
    document.documentElement.classList.add('social-auth-active');
  }

  function hideOverlay() {
    var overlay = document.getElementById('socialAuthOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('social-auth-active');
  }

  function nativeAuthPlugin() {
    try {
      var C = window.Capacitor;
      if (!C || !C.registerPlugin) return null;
      return C.registerPlugin('FirebaseAuthentication');
    } catch (e) {
      return null;
    }
  }

  function ensureFirebase() {
    var fb = cfg.firebase;
    if (!fb || !fb.apiKey || !fb.authDomain || !fb.projectId || !fb.appId) {
      return false;
    }
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) firebase.initializeApp(fb);
    auth = firebase.auth();
    if (firebase.firestore) {
      db = firebase.firestore();
    }
    return true;
  }

  function playersRef(uid) {
    var col = cfg.firestoreCollection || 'players';
    return db.collection(col).doc(uid);
  }

  async function syncGameData(profile) {
    if (!state.signedIn || !state.user || !db || !profile) return null;
    var payload = {
      displayName: state.user.displayName,
      email: state.user.email,
      name: profile.name || '',
      grade: profile.grade || 0,
      class: profile.class || '',
      seat: profile.seat || '',
      level: profile.level || 1,
      exp: profile.exp || 0,
      gameBests: profile.gameBests || {},
      stats: profile.stats || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await playersRef(state.user.uid).set(payload, { merge: true });
    return payload;
  }

  async function pullGameData() {
    if (!state.signedIn || !state.user || !db) return null;
    var snap = await playersRef(state.user.uid).get();
    if (!snap.exists) return null;
    var data = snap.data();
    try {
      window.dispatchEvent(
        new CustomEvent('musicapp:cloud-profile', { detail: data })
      );
    } catch (e) {}
    return data;
  }

  async function signInWithGoogle() {
    var plugin = isNative() ? nativeAuthPlugin() : null;
    if (plugin && plugin.signInWithGoogle) {
      var result = await plugin.signInWithGoogle();
      var idToken =
        result && result.credential && result.credential.idToken;
      if (idToken && auth) {
        var cred = firebase.auth.GoogleAuthProvider.credential(idToken);
        await auth.signInWithCredential(cred);
        return;
      }
      if (result && result.user) {
        setUser({
          uid: result.user.uid || result.user.id,
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoUrl || result.user.photoURL
        });
        return;
      }
    }
    if (!auth) throw new Error('Firebase Auth not ready');
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    if (isNative()) await auth.signInWithRedirect(provider);
    else await auth.signInWithPopup(provider);
  }

  async function signInWithApple() {
    var plugin = isNative() ? nativeAuthPlugin() : null;
    if (plugin && plugin.signInWithApple) {
      var result = await plugin.signInWithApple();
      var idToken =
        result && result.credential && result.credential.idToken;
      var nonce =
        result && result.credential && result.credential.nonce;
      if (idToken && auth) {
        var provider = new firebase.auth.OAuthProvider('apple.com');
        var cred = provider.credential({
          idToken: idToken,
          rawNonce: nonce
        });
        await auth.signInWithCredential(cred);
        return;
      }
      if (result && result.user) {
        setUser({
          uid: result.user.uid || result.user.id,
          displayName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoUrl || result.user.photoURL
        });
        return;
      }
    }
    if (!auth) throw new Error('Firebase Auth not ready');
    var apple = new firebase.auth.OAuthProvider('apple.com');
    apple.addScope('email');
    apple.addScope('name');
    if (isNative()) await auth.signInWithRedirect(apple);
    else await auth.signInWithPopup(apple);
  }

  async function signOut() {
    var plugin = isNative() ? nativeAuthPlugin() : null;
    if (plugin && plugin.signOut) {
      try {
        await plugin.signOut();
      } catch (e) {}
    }
    if (auth) await auth.signOut();
    setUser(null);
  }

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (x) {
        return x !== fn;
      });
    };
  }

  function mapPluginUser(u) {
    if (!u) return null;
    return {
      uid: u.uid || u.id || '',
      displayName: u.displayName || (u.email && u.email.split('@')[0]) || 'Player',
      email: u.email || '',
      photoURL: u.photoUrl || u.photoURL || ''
    };
  }

  function wireButtons() {
    var a = document.getElementById('btnAppleSignIn');
    var g = document.getElementById('btnGoogleSignIn');
    if (a) {
      if (cfg.appleSignInEnabled === false) a.hidden = true;
      else
        a.addEventListener('click', function () {
          window.musicAppSignInApple();
        });
    }
    if (g)
      g.addEventListener('click', function () {
        window.musicAppSignInGoogle();
      });
    var out = document.getElementById('btnSocialSignOut');
    if (out)
      out.addEventListener('click', function () {
        window.musicAppSignOut();
      });
  }

  window.MusicAppAuth = {
    get user() {
      return state.user;
    },
    get signedIn() {
      return state.signedIn;
    },
    get required() {
      return state.required;
    },
    signInWithGoogle: signInWithGoogle,
    signInWithApple: signInWithApple,
    signOut: signOut,
    syncGameData: syncGameData,
    pullGameData: pullGameData,
    subscribe: subscribe
  };

  window.musicAppSignInGoogle = function () {
    signInWithGoogle().catch(function (e) {
      console.warn('[MusicAppAuth] Google', e);
    });
  };
  window.musicAppSignInApple = function () {
    signInWithApple().catch(function (e) {
      console.warn('[MusicAppAuth] Apple', e);
    });
  };
  window.musicAppSignOut = function () {
    signOut().catch(function (e) {
      console.warn('[MusicAppAuth] signOut', e);
    });
  };

  if (!shouldGate()) {
    state.ready = true;
    notify();
    return;
  }

  state.required = true;
  state.signedIn = false;
  window.MUSIC_APP_AUTH_STATE = { required: true, signedIn: false };

  var hasFirebase = ensureFirebase();
  var plugin = isNative() ? nativeAuthPlugin() : null;
  var hasNativePlugin = !!(plugin && plugin.signInWithGoogle);

  if (!hasFirebase && !hasNativePlugin) {
    showOverlay('misconfig');
    state.ready = true;
    notify();
    document.addEventListener('DOMContentLoaded', wireButtons);
    window.addEventListener('musicapp:request-auth', function () {
      showOverlay(hasFirebase || hasNativePlugin ? 'login' : 'misconfig');
    });
    return;
  }

  window.addEventListener('musicapp:request-auth', function () {
    if (!state.signedIn) showOverlay('login');
  });

  if (hasFirebase) {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    auth.getRedirectResult().catch(function (e) {
      console.warn('[MusicAppAuth] getRedirectResult', e);
    });
    auth.onAuthStateChanged(function (user) {
      state.ready = true;
      setUser(user);
    });
  } else if (plugin && plugin.getCurrentUser) {
    plugin
      .getCurrentUser()
      .then(function (res) {
        state.ready = true;
        var mapped = mapPluginUser(res && res.user);
        if (mapped && mapped.uid) setUser(mapped);
        else {
          setUser(null);
          showOverlay('login');
        }
      })
      .catch(function () {
        state.ready = true;
        setUser(null);
        showOverlay('login');
      });
  } else {
    state.ready = true;
    showOverlay('login');
  }

  document.addEventListener('DOMContentLoaded', wireButtons);
})();
