/**
 * AudioEngine — iOS/Safari Web Audio unlock + low-latency tap helper.
 * First touch/pointer/keydown resumes AudioContext (bypasses autoplay mute).
 * Use onInstantTap() instead of click for timing-critical pads (removes ~300ms lag).
 */
(function () {
  'use strict';

  var ctx = null;
  var unlocked = false;
  var extras = [];

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) {
      console.warn('[AudioEngine] create failed', e);
    }
    return ctx;
  }

  function register(externalCtx) {
    if (!externalCtx) return;
    if (!ctx) ctx = externalCtx;
    else if (externalCtx !== ctx && extras.indexOf(externalCtx) < 0) {
      extras.push(externalCtx);
    }
  }

  function resumeOne(c) {
    if (!c) return Promise.resolve();
    if (c.state === 'suspended' || c.state === 'interrupted') {
      return c.resume().catch(function () {});
    }
    return Promise.resolve();
  }

  function unlock() {
    ensureCtx();
    var tasks = [resumeOne(ctx)];
    extras.forEach(function (c) {
      tasks.push(resumeOne(c));
    });
    // Silent buffer fully unlocks iOS
    try {
      if (ctx) {
        var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch (e) {}
    return Promise.all(tasks).then(function () {
      unlocked = true;
      try {
        window.dispatchEvent(new CustomEvent('musicapp:audio-unlocked'));
      } catch (e) {}
      return ctx;
    });
  }

  /**
   * Bind handler on touchstart (primary) + click (desktop fallback), with debounce.
   * Prefer this over onclick for metronome / rhythm pads / piano keys.
   */
  function onInstantTap(el, handler, opts) {
    if (!el || typeof handler !== 'function') return function () {};
    var gap = (opts && opts.debounceMs) || 40;
    var last = 0;
    var fire = function (e) {
      var now = Date.now();
      if (now - last < gap) return;
      last = now;
      if (e.type === 'touchstart') {
        try {
          e.preventDefault();
        } catch (err) {}
      }
      unlock();
      handler(e);
    };
    el.addEventListener('touchstart', fire, { passive: false });
    el.addEventListener('click', fire);
    return function unbind() {
      el.removeEventListener('touchstart', fire);
      el.removeEventListener('click', fire);
    };
  }

  function armGlobalUnlock() {
    var once = function () {
      unlock();
      document.removeEventListener('touchstart', once, true);
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
    };
    document.addEventListener('touchstart', once, { capture: true, passive: true });
    document.addEventListener('pointerdown', once, { capture: true, passive: true });
    document.addEventListener('keydown', once, { capture: true });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') unlock();
    });
  }

  window.AudioEngine = {
    get context() {
      return ensureCtx();
    },
    get unlocked() {
      return unlocked;
    },
    ensureCtx: ensureCtx,
    register: register,
    unlock: unlock,
    onInstantTap: onInstantTap,
    armGlobalUnlock: armGlobalUnlock
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', armGlobalUnlock);
  } else {
    armGlobalUnlock();
  }
})();
