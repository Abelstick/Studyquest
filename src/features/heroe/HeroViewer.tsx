import { useEffect, useRef, useState } from 'react';
import { BoxGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshLambertMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { BONES, buildHeroModel, type Bone, type HeroLook, type HeroModel } from '@/core/hero';

/*
 * Visor 3D del héroe. Este archivo (y three.js con él) solo se descarga al abrir la pantalla
 * del héroe. El modelo llega hecho desde `core/hero`: aquí solo se pinta y se anima.
 */

/** Se pinta a media resolución y se escala sin suavizar: 3D con píxeles gordos, como el resto de la app. */
const PIXEL_RATIO = 0.5;
/** Encuadre fijo (el del héroe más alto con su aura): así al evolucionar se le ve crecer. */
const FRAME_H = 28;
const FRAME_W = 17;
const FOV = 35;

interface Engine {
  setModel: (m: HeroModel) => void;
  resize: (w: number, h: number) => void;
  turn: (radians: number) => void;
  celebrate: () => void;
  dispose: () => void;
}

function createEngine(canvas: HTMLCanvasElement, reduced: boolean): Engine {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(PIXEL_RATIO);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 300);
  const hemi = new HemisphereLight(0xffffff, 0x3a4a5a, 1.7);
  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(8, 16, 12);
  scene.add(hemi, sun);

  // Una sola caja para todo: cada pieza es esa caja escalada. Materiales, uno por color.
  const cube = new BoxGeometry(1, 1, 1);
  const materials = new Map<string, MeshLambertMaterial>();
  const material = (color: string, glow: boolean, alpha: number) => {
    const key = `${color}|${glow}|${alpha}`;
    let m = materials.get(key);
    if (!m) {
      m = new MeshLambertMaterial({ color, emissive: glow ? color : '#000000', emissiveIntensity: glow ? 0.85 : 0, transparent: alpha < 1, opacity: alpha, depthWrite: alpha >= 1 });
      materials.set(key, m);
    }
    return m;
  };
  const block = (parent: Group, at: [number, number, number], size: [number, number, number], color: string, glow = false, alpha = 1) => {
    const mesh = new Mesh(cube, material(color, glow, alpha));
    mesh.position.set(...at);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  };

  // Plataforma giratoria: bloque de hierba con tierra debajo.
  const turntable = new Group();
  scene.add(turntable);
  block(turntable, [0, -0.5, 0], [11, 1, 11], '#5ac54f');
  block(turntable, [0, -2.2, 0], [10.4, 2.4, 10.4], '#9c5b2e');
  for (const [x, z] of [[-3, 5.25], [2, 5.25], [5.25, -1], [-5.25, 2]]) block(turntable, [x, -2, z], [1, 1, 0.3], '#6b3b1c');

  let hero: { root: Group; bones: Record<Bone, Group>; model: HeroModel } | null = null;
  // Empieza en tres cuartos: así se ven caparazones, capas y alas sin tener que girarlo.
  let yaw = -0.6;
  let dragging = false;
  let celebrateFrom = -1;
  let raf = 0;
  let last = 0;
  let visible = true;

  const place = (w: number, h: number) => {
    camera.aspect = w / Math.max(1, h);
    const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
    const dist = Math.max(FRAME_H / 2 / tan, FRAME_W / 2 / (tan * camera.aspect));
    camera.position.set(0, FRAME_H * 0.52, dist);
    camera.lookAt(0, FRAME_H * 0.44, 0);
    camera.updateProjectionMatrix();
  };

  const animate = (t: number) => {
    if (!hero) return;
    const { root, bones, model } = hero;
    const k = reduced ? 0 : 1;
    const breathe = Math.sin(t * 2);
    root.position.y = model.hover + (breathe * 0.25 + (model.hover ? Math.sin(t * 1.3) * 0.5 : 0)) * k;
    bones.armL.rotation.x = breathe * 0.09 * k;
    bones.armR.rotation.x = -breathe * 0.09 * k;
    bones.head.rotation.y = Math.sin(t * 0.7) * 0.12 * k;
    bones.body.scale.y = 1 + breathe * 0.015 * k;
    bones.tail.rotation.y = Math.sin(t * 2.5) * 0.3 * k;
    bones.wingL.rotation.y = Math.sin(t * 6) * 0.22 * k;
    bones.wingR.rotation.y = -Math.sin(t * 6) * 0.22 * k;
    bones.fx.rotation.y = t * 1.1 * k;
    bones.aura.scale.set(1, 1 + Math.sin(t * 5) * 0.08 * k, 1);

    // Evolución: el héroe da una vuelta, crece un instante y se ilumina.
    let pop = 0;
    if (celebrateFrom >= 0) {
      const p = (t - celebrateFrom) / 1.6;
      if (p >= 1) celebrateFrom = -1;
      else {
        pop = Math.sin(p * Math.PI);
        root.rotation.y = p * Math.PI * 2;
      }
    }
    if (celebrateFrom < 0) root.rotation.y = 0;
    root.scale.setScalar(model.scale * (1 + pop * 0.22));
    hemi.intensity = 1.7 + pop * 3;
  };

  const running = () => visible && !document.hidden && (!reduced || dragging);

  const tick = (ms: number) => {
    raf = 0;
    const t = ms / 1000;
    const dt = last ? Math.min(0.1, t - last) : 0;
    last = t;
    if (!reduced && !dragging && celebrateFrom < 0) yaw += dt * 0.35;
    turntable.rotation.y = yaw;
    animate(t);
    renderer.render(scene, camera);
    if (running() || celebrateFrom >= 0) raf = requestAnimationFrame(tick);
  };
  const invalidate = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  // Dejar de pintar cuando no se ve (otra pestaña o fuera de pantalla) ahorra batería.
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) invalidate();
  });
  io.observe(canvas);
  const onVisibility = () => {
    last = 0;
    if (!document.hidden) invalidate();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Arrastrar para girar. `touch-action: pan-y` (en el CSS) deja el scroll vertical al móvil.
  let lastX = 0;
  const down = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    invalidate();
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    invalidate();
  };
  const up = (e: PointerEvent) => {
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    last = 0;
    invalidate();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  return {
    setModel(model) {
      if (hero) turntable.remove(hero.root);
      const root = new Group();
      const bones = {} as Record<Bone, Group>;
      for (const b of BONES) {
        const g = new Group();
        g.position.set(...model.pivots[b]);
        root.add(g);
        bones[b] = g;
      }
      for (const p of model.parts) {
        const pv = model.pivots[p.bone];
        const mesh = block(bones[p.bone], [p.at[0] - pv[0], p.at[1] - pv[1], p.at[2] - pv[2]], p.size, p.color, !!p.glow, p.alpha ?? 1);
        if (p.rot) mesh.rotation.set(...p.rot);
      }
      root.scale.setScalar(model.scale);
      turntable.add(root);
      hero = { root, bones, model };
      invalidate();
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      place(w, h);
      invalidate();
    },
    turn(r) {
      yaw += r;
      invalidate();
    },
    celebrate() {
      if (reduced) return;
      celebrateFrom = performance.now() / 1000;
      invalidate();
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      cube.dispose();
      for (const m of materials.values()) m.dispose();
      renderer.dispose();
    },
  };
}

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HeroViewer({ look, label, celebrate = 0 }: { look: HeroLook; label: string; /** Al cambiar, se reproduce la animación de evolución. */ celebrate?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    let e: Engine;
    try {
      e = createEngine(el, prefersReduced());
    } catch {
      // Sin WebGL (navegador antiguo o aceleración desactivada): se explica en texto.
      setFailed(true);
      return;
    }
    engine.current = e;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) e.resize(width, height);
    });
    ro.observe(box);
    const lost = (ev: Event) => {
      ev.preventDefault();
      setFailed(true);
    };
    el.addEventListener('webglcontextlost', lost);
    return () => {
      ro.disconnect();
      el.removeEventListener('webglcontextlost', lost);
      e.dispose();
      engine.current = null;
    };
  }, []);

  const { race, stage, weapon, power, skin } = look;
  useEffect(() => {
    engine.current?.setModel(buildHeroModel({ race, stage, weapon, power, skin }));
  }, [race, stage, weapon, power, skin, failed]);

  useEffect(() => {
    if (celebrate) engine.current?.celebrate();
  }, [celebrate]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') engine.current?.turn(-0.4);
    else if (e.key === 'ArrowRight') engine.current?.turn(0.4);
    else return;
    e.preventDefault();
  };

  if (failed)
    return (
      <div className="hero3d hero3d--off" role="img" aria-label={label}>
        <p className="hero3d__off">Tu navegador no puede mostrar 3D ahora mismo.</p>
        <p className="muted small">{label}</p>
      </div>
    );

  return (
    <div className="hero3d" ref={wrap}>
      <canvas ref={canvas} className="hero3d__canvas" role="img" aria-label={label} tabIndex={0} onKeyDown={onKey} />
      <div className="hero3d__turn">
        <button type="button" className="icon-btn icon-btn--sm" aria-label="Girar a la izquierda" onClick={() => engine.current?.turn(-0.6)}>
          ◀
        </button>
        <span className="hero3d__hint" aria-hidden="true">
          arrastra para girar
        </span>
        <button type="button" className="icon-btn icon-btn--sm" aria-label="Girar a la derecha" onClick={() => engine.current?.turn(0.6)}>
          ▶
        </button>
      </div>
    </div>
  );
}
