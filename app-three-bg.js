/**
 * App shell Three.js ambient — optimized for phone (Capacitor).
 * Shared geo/materials, Lambert (no PBR), ~30fps, pause when hidden.
 */
(function () {
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  const COLORS = [0x6c4fcc, 0xff8a65, 0x4db6ac, 0xf06292, 0x7e57c2, 0x42a5f5];
  const FRAME_MS = 33; // ~30fps

  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let canvas = null;
  let host = null;
  let notes = [];
  let shared = null;
  let raf = 0;
  let running = false;
  let visible = false;
  let reduced = false;
  let lowPower = false;
  let loadPromise = null;
  let lastFrame = 0;
  let resizeTimer = 0;
  let listenersOn = false;

  function prefersReduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function isLowPowerDevice() {
    try {
      const cores = navigator.hardwareConcurrency || 4;
      const mem = navigator.deviceMemory || 4;
      const small = Math.min(window.innerWidth, window.innerHeight) < 500;
      return cores <= 4 || mem <= 4 || small;
    } catch (e) {
      return true;
    }
  }

  function ensureShared() {
    if (shared) return shared;
    const headGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
    const flagGeo = new THREE.SphereGeometry(0.14, 8, 6);
    const stemMat = new THREE.MeshLambertMaterial({
      color: 0x3a3550,
      transparent: true,
      opacity: 0.72,
    });
    const mats = COLORS.map(
      (c) =>
        new THREE.MeshLambertMaterial({
          color: c,
          transparent: true,
          opacity: 0.9,
          emissive: c,
          emissiveIntensity: 0.12,
        })
    );
    shared = { headGeo, stemGeo, flagGeo, stemMat, mats };
    return shared;
  }

  function makeNoteMesh() {
    const s = ensureShared();
    const mat = s.mats[(Math.random() * s.mats.length) | 0];
    const group = new THREE.Group();

    const head = new THREE.Mesh(s.headGeo, mat);
    head.scale.set(1.2, 0.88, 1);
    group.add(head);

    const stem = new THREE.Mesh(s.stemGeo, s.stemMat);
    stem.position.set(0.24, 0.46, 0);
    group.add(stem);

    const flag = new THREE.Mesh(s.flagGeo, mat);
    flag.scale.set(1.5, 0.5, 0.35);
    flag.position.set(0.36, 0.86, 0);
    group.add(flag);

    return group;
  }

  function maxDpr() {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(dpr, lowPower ? 1.15 : 1.4);
  }

  function resize() {
    if (!renderer || !camera || !host) return;
    const w = Math.max(host.clientWidth || window.innerWidth, 1);
    const h = Math.max(host.clientHeight || window.innerHeight, 1);
    renderer.setPixelRatio(maxDpr());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }

  function tick(t) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    if (t - lastFrame < FRAME_MS) return;
    lastFrame = t;

    const sec = t * 0.001;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const u = n.userData;
      n.position.y = u.baseY + Math.sin(sec * u.speed + u.phase) * u.amp;
      n.position.x = u.baseX + Math.cos(sec * u.speed * 0.65 + u.phase) * u.drift;
      n.rotation.y = sec * u.spin;
      n.rotation.z = Math.sin(sec * 0.55 + u.phase) * 0.28;
    }
    renderer.render(scene, camera);
  }

  function startLoop() {
    if (running || reduced) return;
    running = true;
    lastFrame = 0;
    raf = requestAnimationFrame(tick);
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function buildScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 24);
    camera.position.set(0, 0.12, 5.2);

    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc4b5fd, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(2.2, 4, 3);
    scene.add(key);

    notes = [];
    const count = reduced ? 4 : lowPower ? 7 : 10;
    for (let i = 0; i < count; i++) {
      const mesh = makeNoteMesh();
      const baseX = (Math.random() - 0.5) * 4.6;
      const baseY = (Math.random() - 0.5) * 3.2;
      const z = -0.3 - Math.random() * 2.2;
      mesh.position.set(baseX, baseY, z);
      mesh.scale.setScalar(0.7 + Math.random() * 0.75);
      mesh.userData = {
        baseX,
        baseY,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.5,
        amp: 0.18 + Math.random() * 0.32,
        drift: 0.08 + Math.random() * 0.22,
        spin: (Math.random() - 0.5) * 0.75,
      };
      scene.add(mesh);
      notes.push(mesh);
    }
  }

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (loadPromise) return loadPromise;
    loadPromise = import(CDN)
      .then((mod) => {
        THREE = mod;
        return THREE;
      })
      .catch((e) => {
        loadPromise = null;
        throw e;
      });
    return loadPromise;
  }

  function bindListeners() {
    if (listenersOn) return;
    listenersOn = true;
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
  }

  function unbindListeners() {
    if (!listenersOn) return;
    listenersOn = false;
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    clearTimeout(resizeTimer);
  }

  async function mount(el) {
    host = el || document.getElementById('screen-app-root');
    if (!host) return false;
    reduced = prefersReduced();
    lowPower = isLowPowerDevice();

    try {
      await ensureThree();
    } catch (e) {
      console.warn('[app-three-bg] three load failed', e);
      return false;
    }

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'appThreeBg';
      canvas.setAttribute('aria-hidden', 'true');
      host.insertBefore(canvas, host.firstChild);
    }

    if (!renderer) {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
        stencil: false,
        depth: true,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(maxDpr());
      buildScene();
    }

    resize();
    document.documentElement.classList.add('app-three');
    bindListeners();

    if (reduced) {
      visible = true;
      renderer.render(scene, camera);
    } else {
      setActive(true);
    }
    return true;
  }

  function onVisibility() {
    if (document.hidden) {
      stopLoop();
      return;
    }
    if (visible) {
      if (renderer && scene && camera) renderer.render(scene, camera);
      startLoop();
    }
  }

  function setActive(on) {
    visible = !!on;
    if (canvas) canvas.style.opacity = on ? '1' : '0';
    if (!on) {
      stopLoop();
      return;
    }
    if (renderer && scene && camera) {
      resize();
      renderer.render(scene, camera);
    }
    if (!reduced) startLoop();
  }

  function disposeShared() {
    if (!shared) return;
    shared.headGeo.dispose();
    shared.stemGeo.dispose();
    shared.flagGeo.dispose();
    shared.stemMat.dispose();
    for (let i = 0; i < shared.mats.length; i++) shared.mats[i].dispose();
    shared = null;
  }

  function destroy() {
    stopLoop();
    visible = false;
    unbindListeners();
    document.documentElement.classList.remove('app-three');
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    disposeShared();
    scene = null;
    camera = null;
    notes = [];
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    host = null;
  }

  window.AppThreeBg = { mount, setActive, destroy };

  function isAppShellHint() {
    try {
      const C = window.Capacitor;
      if (C && typeof C.isNativePlatform === 'function' && C.isNativePlatform()) return true;
      if (C && typeof C.getPlatform === 'function' && C.getPlatform() !== 'web') return true;
    } catch (e) {}
    try {
      if (new URLSearchParams(location.search).get('app') === '1') return true;
      if (localStorage.getItem('forceAppShell') === '1') return true;
    } catch (e) {}
    return document.documentElement.classList.contains('app-shell');
  }

  function autoBoot(attempt) {
    if (!isAppShellHint()) return;
    const root = document.getElementById('screen-app-root');
    if (!root) {
      if (attempt < 20) setTimeout(() => autoBoot(attempt + 1), 100);
      return;
    }
    if (renderer) {
      setActive(true);
      return;
    }
    mount(root)
      .then((ok) => {
        if (!ok && attempt < 10) setTimeout(() => autoBoot(attempt + 1), 220);
      })
      .catch(() => {
        if (attempt < 10) setTimeout(() => autoBoot(attempt + 1), 250);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => autoBoot(0), 120));
  } else {
    setTimeout(() => autoBoot(0), 120);
  }
})();
