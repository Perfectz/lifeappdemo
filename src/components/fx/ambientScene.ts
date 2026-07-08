/**
 * Ambient JRPG backdrop: drifting "mana motes" over a slow retro horizon
 * grid, with a pooled celebration burst. Plain TS — no React. This module
 * statically imports three, so it must only ever be loaded via dynamic
 * import() to keep three out of the initial bundle.
 */

import * as THREE from "three";

import { celebrateEventName, type CelebrationDetail } from "@/client/celebrate";

export type AmbientSceneOptions = {
  /** When true, render a single static frame and never start the rAF loop. */
  reducedMotion: boolean;
};

export type AmbientSceneHandle = {
  dispose(): void;
};

const MAX_PIXEL_RATIO = 1.5;
const MOTE_COUNT_WIDE = 110;
const MOTE_COUNT_NARROW = 55;
const WIDE_VIEWPORT_PX = 860;
const BURST_COUNT = 90;
const BURST_DURATION_S = 1.4;
const PARALLAX_LERP = 0.02;
const PARALLAX_MAX_PX = 14;
const CAMERA_Z = 40;

const BURST_COLORS: Record<CelebrationDetail["kind"], string> = {
  levelup: "#f6c768", // gold
  quest: "#6ee7b7", // accent green fallback; replaced by live --accent
  streak: "#fff3e0", // warm white
  pr: "#ffd76a" // brighter gold for personal records
};

type ThemeColors = {
  accent: THREE.Color;
  lineStrong: THREE.Color;
  accentStrong: THREE.Color;
  /** True when the theme background is light (e.g. gameboy). */
  lightBg: boolean;
};

function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): THREE.Color => {
    const raw = styles.getPropertyValue(name).trim();
    try {
      return new THREE.Color(raw || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  };
  const bg = read("--bg", "#0d1117");
  const luminance = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
  return {
    accent: read("--accent", "#6ee7b7"),
    lineStrong: read("--line-strong", "#3d8bfd"),
    accentStrong: read("--accent-strong", "#f6c768"),
    lightBg: luminance > 0.5
  };
}

/** Soft round glow sprite drawn on a small canvas — no asset fetch. */
function makeMoteTexture(): THREE.Texture | null {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createAmbientScene(
  canvas: HTMLCanvasElement,
  options: AmbientSceneOptions
): AmbientSceneHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "low-power"
    });
  } catch {
    // WebGL unavailable — the backdrop simply doesn't exist.
    return null;
  }

  // Clamp to ≥1: a zero-sized window (background tab prerender, minimized
  // restore, some webviews) makes width/height → 0/0 = NaN, which poisons
  // every world-space position and triggers
  // "computeBoundingSphere(): Computed radius is NaN".
  let width = Math.max(1, window.innerWidth);
  let height = Math.max(1, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
  camera.position.set(0, 0, CAMERA_Z);

  // World-space size of the viewport at the z=0 plane, so positions can be
  // reasoned about in "screen-ish" units.
  const worldHeightAt = (distance: number) =>
    2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let worldH = worldHeightAt(CAMERA_Z);
  let worldW = worldH * (width / height);

  const group = new THREE.Group();
  scene.add(group);

  let theme = readThemeColors();

  // --- Mana motes -----------------------------------------------------------
  const moteCount = width >= WIDE_VIEWPORT_PX ? MOTE_COUNT_WIDE : MOTE_COUNT_NARROW;
  const motePositions = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  // Per-mote drift params (not GPU attributes; updated on CPU per frame).
  const moteSpeed = new Float32Array(moteCount);
  const moteSwayAmp = new Float32Array(moteCount);
  const moteSwayFreq = new Float32Array(moteCount);
  const moteSwayPhase = new Float32Array(moteCount);
  const moteBaseX = new Float32Array(moteCount);

  const depthSpan = 24;
  for (let i = 0; i < moteCount; i++) {
    const x = (Math.random() - 0.5) * worldW * 1.2;
    motePositions[i * 3] = x;
    motePositions[i * 3 + 1] = (Math.random() - 0.5) * worldH * 1.2;
    motePositions[i * 3 + 2] = -Math.random() * depthSpan;
    moteBaseX[i] = x;
    moteSpeed[i] = 0.35 + Math.random() * 0.55; // world units / s, slow rise
    moteSwayAmp[i] = 0.4 + Math.random() * 1.1;
    moteSwayFreq[i] = 0.15 + Math.random() * 0.35;
    moteSwayPhase[i] = Math.random() * Math.PI * 2;
  }

  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute("color", new THREE.BufferAttribute(moteColors, 3));

  const moteTexture = makeMoteTexture();
  const moteMaterial = new THREE.PointsMaterial({
    size: 0.9,
    map: moteTexture ?? undefined,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  // Fullscreen backdrop — always in view, so frustum culling buys nothing
  // and its lazy computeBoundingSphere() is the code path that logs when a
  // position ever goes non-finite. Skip it.
  motes.frustumCulled = false;
  group.add(motes);

  // --- Horizon grid ----------------------------------------------------------
  const gridGeometry = new THREE.PlaneGeometry(worldW * 3, 120, 24, 30);
  const gridMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    depthWrite: false
  });
  const grid = new THREE.Mesh(gridGeometry, gridMaterial);
  grid.frustumCulled = false; // same rationale as the motes
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -worldH * 0.28; // bottom third of the view
  grid.position.z = -30;
  group.add(grid);
  const gridCell = 120 / 30; // one segment of scroll = seamless wrap
  let gridScroll = 0;

  function applyTheme() {
    // Motes: mix of accent and line-strong per particle. On light themes the
    // additive blend would wash out, so dim everything down.
    const colorAttr = moteGeometry.getAttribute("color") as THREE.BufferAttribute;
    const mixed = new THREE.Color();
    for (let i = 0; i < moteCount; i++) {
      const t = (i % 5) / 5; // stable per-mote mix, no per-frame churn
      mixed.copy(theme.accent).lerp(theme.lineStrong, t * 0.6);
      colorAttr.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }
    colorAttr.needsUpdate = true;
    moteMaterial.opacity = theme.lightBg ? 0.28 : 0.55;
    gridMaterial.color.copy(theme.lineStrong);
    gridMaterial.opacity = 0.08;
    // Additive wireframe over a light background (Game Boy LCD) reads as a
    // murky band through translucent panels — hide the horizon entirely and
    // let the dim motes carry the atmosphere on light themes.
    grid.visible = !theme.lightBg;
  }
  applyTheme();

  const themeObserver = new MutationObserver(() => {
    theme = readThemeColors();
    applyTheme();
    if (options.reducedMotion) renderOnce();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  // --- Celebration burst (pooled) ---------------------------------------------
  const burstPositions = new Float32Array(BURST_COUNT * 3);
  const burstVelocities = new Float32Array(BURST_COUNT * 3);
  const burstGeometry = new THREE.BufferGeometry();
  burstGeometry.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3));
  const burstMaterial = new THREE.PointsMaterial({
    size: 1.1,
    map: moteTexture ?? undefined,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  const burst = new THREE.Points(burstGeometry, burstMaterial);
  burst.visible = false;
  burst.frustumCulled = false;
  scene.add(burst);
  let burstElapsed = 0;
  let burstActive = false;

  function startBurst(kind: CelebrationDetail["kind"]) {
    const color =
      kind === "quest"
        ? theme.accent
        : new THREE.Color(BURST_COLORS[kind] ?? BURST_COLORS.streak);
    burstMaterial.color.copy(color);
    const originY = -worldH * 0.3;
    for (let i = 0; i < BURST_COUNT; i++) {
      burstPositions[i * 3] = 0;
      burstPositions[i * 3 + 1] = originY;
      burstPositions[i * 3 + 2] = -4;
      // Radial fan biased upward, like a fountain of sparks.
      const angle = Math.random() * Math.PI; // upper half
      const speed = 6 + Math.random() * 14;
      burstVelocities[i * 3] = Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1);
      burstVelocities[i * 3 + 1] = Math.sin(angle) * speed;
      burstVelocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    (burstGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    burstElapsed = 0;
    burstActive = true;
    burst.visible = true;
  }

  function stepBurst(dt: number) {
    if (!burstActive) return;
    burstElapsed += dt;
    const t = Math.min(burstElapsed / BURST_DURATION_S, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const attr = burstGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < BURST_COUNT; i++) {
      attr.setXYZ(
        i,
        burstVelocities[i * 3] * ease,
        -worldH * 0.3 + burstVelocities[i * 3 + 1] * ease - 3 * t * t,
        -4 + burstVelocities[i * 3 + 2] * ease
      );
    }
    attr.needsUpdate = true;
    burstMaterial.opacity = (theme.lightBg ? 0.5 : 0.9) * (1 - t);
    if (t >= 1) {
      burstActive = false;
      burst.visible = false; // reclaimed; pool reused on the next event
    }
  }

  function onCelebrate(event: Event) {
    const detail = (event as CustomEvent<CelebrationDetail>).detail;
    startBurst(detail?.kind ?? "quest");
    // Reduced motion never animates — the burst is skipped by not looping.
    if (!options.reducedMotion) resume();
  }
  window.addEventListener(celebrateEventName, onCelebrate);

  // --- Parallax ----------------------------------------------------------------
  const pointerTarget = new THREE.Vector2(0, 0);
  const hasFinePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: fine)").matches;

  function onPointerMove(event: PointerEvent) {
    // Normalized -0.5..0.5, mapped to a max world-space offset equal to
    // PARALLAX_MAX_PX at the z=0 plane.
    const maxWorld = (PARALLAX_MAX_PX / height) * worldH;
    pointerTarget.set(
      (event.clientX / width - 0.5) * 2 * maxWorld,
      -(event.clientY / height - 0.5) * 2 * maxWorld
    );
  }
  if (hasFinePointer) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  // --- Resize --------------------------------------------------------------------
  function onResize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    worldH = worldHeightAt(CAMERA_Z);
    worldW = worldH * (width / height);
    grid.position.y = -worldH * 0.28;
    if (options.reducedMotion) renderOnce();
  }
  window.addEventListener("resize", onResize);

  // --- Animation loop ---------------------------------------------------------------
  let rafId: number | null = null;
  let lastTime = 0;
  let elapsed = 0;
  let disposed = false;

  function step(now: number) {
    rafId = null;
    const dt = lastTime === 0 ? 0.016 : Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    elapsed += dt;

    // Motes drift up with a sine sway, wrapping at the top.
    const posAttr = moteGeometry.getAttribute("position") as THREE.BufferAttribute;
    const topBound = worldH * 0.62;
    for (let i = 0; i < moteCount; i++) {
      let y = posAttr.getY(i) + moteSpeed[i] * dt;
      if (y > topBound) {
        y = -topBound;
        moteBaseX[i] = (Math.random() - 0.5) * worldW * 1.2;
      }
      const x =
        moteBaseX[i] +
        Math.sin(elapsed * moteSwayFreq[i] * Math.PI * 2 + moteSwayPhase[i]) *
          moteSwayAmp[i];
      posAttr.setX(i, x);
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;

    // Grid crawls toward the camera, wrapping every cell for a seamless loop.
    gridScroll = (gridScroll + dt * 1.5) % gridCell;
    grid.position.z = -30 + gridScroll;

    // Parallax ease.
    group.position.x += (pointerTarget.x - group.position.x) * PARALLAX_LERP;
    group.position.y += (pointerTarget.y - group.position.y) * PARALLAX_LERP;

    stepBurst(dt);

    renderer.render(scene, camera);
    if (!disposed) rafId = requestAnimationFrame(step);
  }

  function renderOnce() {
    renderer.render(scene, camera);
  }

  function pause() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTime = 0; // avoid a giant dt on resume
  }

  function resume() {
    if (disposed || options.reducedMotion) return;
    if (rafId === null) rafId = requestAnimationFrame(step);
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") pause();
    else resume();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (options.reducedMotion) {
    renderOnce(); // one static frame, no loop
  } else {
    resume();
  }

  return {
    dispose() {
      disposed = true;
      pause();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(celebrateEventName, onCelebrate);
      if (hasFinePointer) window.removeEventListener("pointermove", onPointerMove);
      themeObserver.disconnect();
      moteGeometry.dispose();
      moteMaterial.dispose();
      gridGeometry.dispose();
      gridMaterial.dispose();
      burstGeometry.dispose();
      burstMaterial.dispose();
      moteTexture?.dispose();
      renderer.dispose();
    }
  };
}
