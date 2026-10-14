import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ═══════════════════════════════════════════════════════════════
   CLAY SCENE — soft, glossy 3D shapes that float and follow the mouse.
   Light-only palette (violet, sky, mint, sunshine, lilac). Pauses when
   off-screen, honours reduced-motion, and falls back to CSS blobs when
   WebGL isn't available. Always lazy-load this file (three.js is big).
   ═══════════════════════════════════════════════════════════════ */

const PALETTE = {
  violet: '#7C5CFF', sky: '#5AA2FF', mint: '#3DD6A3', sun: '#FFC83D', lilac: '#7CC4FF', peach: '#FFB27A', white: '#FFFFFF',
};

const LAYOUTS = {
  // Home hero: a little "sales desk" — a chat bubble, a lead card, coins of attention, a ring
  home: [
    { kind: 'card', color: 'white', pos: [0.9, 0.15, 0], rot: [0.25, -0.5, 0.08], scale: 1.0 },
    { kind: 'bubble', color: 'violet', pos: [-0.55, 0.75, 0.4], rot: [0.1, 0.4, -0.15], scale: 0.62 },
    { kind: 'sphere', color: 'mint', pos: [1.85, 1.0, -0.4], scale: 0.32 },
    { kind: 'torus', color: 'sun', pos: [-0.9, -0.65, 0.2], rot: [1.1, 0.3, 0.2], scale: 0.42 },
    { kind: 'sphere', color: 'sky', pos: [0.1, -1.05, 0.6], scale: 0.22 },
    { kind: 'capsule', color: 'lilac', pos: [2.05, -0.75, 0.1], rot: [0.3, 0.2, 0.9], scale: 0.34 },
    { kind: 'sphere', color: 'peach', pos: [-1.7, 0.25, -0.6], scale: 0.18 },
  ],
  // Sign-in screen: a calm cluster
  auth: [
    { kind: 'bubble', color: 'violet', pos: [-0.2, 0.55, 0.2], rot: [0.1, 0.4, -0.1], scale: 0.9 },
    { kind: 'card', color: 'white', pos: [0.55, -0.55, 0.5], rot: [0.2, -0.45, 0.1], scale: 0.8 },
    { kind: 'torus', color: 'sun', pos: [1.35, 0.95, -0.3], rot: [1.0, 0.3, 0.2], scale: 0.4 },
    { kind: 'sphere', color: 'mint', pos: [-1.35, -0.7, 0.1], scale: 0.34 },
    { kind: 'sphere', color: 'sky', pos: [1.5, -1.25, 0.2], scale: 0.2 },
    { kind: 'capsule', color: 'lilac', pos: [-1.45, 1.2, -0.4], rot: [0.2, 0.1, 0.7], scale: 0.3 },
  ],
  // Small accent for page headers
  mini: [
    { kind: 'sphere', color: 'violet', pos: [-0.6, 0.15, 0], scale: 0.55 },
    { kind: 'torus', color: 'sun', pos: [0.7, 0.35, -0.2], rot: [1.0, 0.4, 0.2], scale: 0.42 },
    { kind: 'sphere', color: 'mint', pos: [0.35, -0.55, 0.4], scale: 0.26 },
  ],
};

function clayMaterial(hex) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffffff'),
  });
}

function buildShape(item) {
  const group = new THREE.Group();
  const mat = clayMaterial(PALETTE[item.color] || item.color);
  if (item.kind === 'sphere') {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), mat));
  } else if (item.kind === 'torus') {
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.34, 32, 64), mat));
  } else if (item.kind === 'capsule') {
    group.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.1, 12, 32), mat));
  } else if (item.kind === 'bubble') {
    // chat bubble: a soft box with a little tail and three "typing" dots
    group.add(new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.4, 0.6, 6, 0.42), mat));
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 24), mat);
    tail.position.set(-0.55, -0.82, 0);
    tail.rotation.z = Math.PI * 0.85;
    group.add(tail);
    const dotMat = clayMaterial('#FFFFFF');
    [-0.5, 0, 0.5].forEach((x) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 24), dotMat);
      d.position.set(x, 0, 0.32);
      d.userData.typing = x;
      group.add(d);
    });
  } else if (item.kind === 'card') {
    // a lead card: white slab, avatar, two text bars and a violet "hot" pill
    group.add(new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.5, 0.22, 6, 0.16), mat));
    const avatar = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), clayMaterial(PALETTE.lilac));
    avatar.position.set(-0.75, 0.25, 0.17);
    avatar.scale.z = 0.5;
    group.add(avatar);
    const bar = (w, y, color) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.16, 0.08, 4, 0.06), clayMaterial(color));
      m.position.set(-0.32 + w / 2, y, 0.14);
      group.add(m);
    };
    bar(1.15, 0.36, '#EDE9FF');
    bar(0.8, 0.12, '#E7E5E4');
    const pill = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.3, 0.12, 4, 0.12), clayMaterial(PALETTE.mint));
    pill.position.set(-0.5, -0.38, 0.15);
    group.add(pill);
    const pill2 = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.3, 0.12, 4, 0.12), clayMaterial(PALETTE.sun));
    pill2.position.set(0.35, -0.38, 0.15);
    group.add(pill2);
  }
  group.position.set(...item.pos);
  if (item.rot) group.rotation.set(...item.rot);
  group.scale.setScalar(item.scale || 1);
  group.userData.base = { pos: [...item.pos], rot: item.rot ? [...item.rot] : [0, 0, 0] };
  group.userData.phase = Math.random() * Math.PI * 2;
  return group;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export default function ClayScene({ variant = 'home', className = '', style }) {
  const mountRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    if (!webglAvailable()) { setFallback(true); return undefined; }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch { setFallback(true); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, variant === 'mini' ? 5 : 7.2);

    scene.add(new THREE.HemisphereLight('#ffffff', '#c9c3ff', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#b9d4ff', 0.8);
    rim.position.set(-5, -2, -3);
    scene.add(rim);

    const root = new THREE.Group();
    const shapes = (LAYOUTS[variant] || LAYOUTS.home).map(buildShape);
    shapes.forEach((s) => root.add(s));
    scene.add(root);

    // soft contact shadow under everything
    const shadowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(28,25,23,0.28)');
      grd.addColorStop(1, 'rgba(28,25,23,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = variant === 'mini' ? -1.1 : -1.75;
    scene.add(shadow);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      // keep the cluster in frame on narrow screens
      camera.position.z = (variant === 'mini' ? 5 : 7.2) * Math.max(1, 1.25 / camera.aspect);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const target = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(mount);

    const clock = new THREE.Clock();
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      root.rotation.y += ((target.x * 0.35) - root.rotation.y) * 0.05;
      root.rotation.x += ((target.y * 0.2) - root.rotation.x) * 0.05;
      if (!reduceMotion) {
        shapes.forEach((s, i) => {
          const { pos, rot } = s.userData.base;
          const ph = s.userData.phase;
          s.position.y = pos[1] + Math.sin(t * 0.9 + ph) * 0.09;
          s.rotation.x = rot[0] + Math.sin(t * 0.5 + ph) * 0.06;
          s.rotation.y = rot[1] + Math.sin(t * 0.4 + ph + i) * 0.1;
          s.children.forEach((c) => {
            if (c.userData.typing !== undefined) c.position.z = 0.32 + Math.max(0, Math.sin(t * 5 - c.userData.typing * 4)) * 0.12;
          });
        });
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [variant]);

  if (fallback) return <CssClay className={className} style={style} />;
  return <div ref={mountRef} className={className} style={{ position: 'relative', ...style }} aria-hidden />;
}

/* Same mood without WebGL: layered CSS "clay" blobs */
export function CssClay({ className = '', style }) {
  const blob = (size, c1, c2, x, y, cls) => (
    <span className={cls} style={{
      position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 28%, #ffffffcc 0 12%, ${c1} 34%, ${c2} 100%)`,
      boxShadow: `0 18px 30px -14px ${c2}aa`,
    }} />
  );
  return (
    <div className={className} style={{ position: 'relative', ...style }} aria-hidden>
      {blob(120, '#A496FF', '#5B3DF5', '30%', '18%', 'float-slow')}
      {blob(70, '#7FE3C1', '#17B686', '62%', '52%', 'float-slower')}
      {blob(54, '#FFD772', '#F5A40B', '12%', '58%', 'float-slower')}
      {blob(38, '#8EC5FF', '#3B82F6', '74%', '16%', 'float-slow')}
    </div>
  );
}
