"use client";

import React, { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import * as THREE from "three";
import Link from "next/link";

// ── Module-level cache (bütün render-lər paylaşır) ──────────────
let heroCache: { heroTitle: string; heroBadge: string; heroSubtitle: string } | null = null;
let statsCache: { quizCount: number; matCount: number; userCount: number } | null = null;

// ── Three.js Canvas ──────────────────────────────────────────────
const WovenCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // max 2x — performans
    mountRef.current.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);
    const clock  = new THREE.Clock();
    // Particle sayını azaldıram: 50000 → 25000
    const N = 25000;
    const pos  = new Float32Array(N * 3);
    const orig = new Float32Array(N * 3);
    const cols = new Float32Array(N * 3);
    const vel  = new Float32Array(N * 3);
    const geo  = new THREE.BufferGeometry();
    const tk   = new THREE.TorusKnotGeometry(1.5, 0.5, 150, 24); // daha az segment

    for (let i = 0; i < N; i++) {
      const vi = i % tk.attributes.position.count;
      const x = tk.attributes.position.getX(vi);
      const y = tk.attributes.position.getY(vi);
      const z = tk.attributes.position.getZ(vi);
      pos[i*3]=orig[i*3]=x; pos[i*3+1]=orig[i*3+1]=y; pos[i*3+2]=orig[i*3+2]=z;
      const c = new THREE.Color();
      const hue = Math.random() < 0.6 ? 0.55 + Math.random() * 0.1 : 0.38 + Math.random() * 0.08;
      c.setHSL(hue, 0.75, 0.55 + Math.random() * 0.2);
      cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.PointsMaterial({ size: 0.025, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8 });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);

    const onMove = (e: MouseEvent) => {
      const r = mountRef.current?.getBoundingClientRect();
      if (!r) return;
      mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
      mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove);

    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t  = clock.getElapsedTime();
      const mw = new THREE.Vector3(mouse.x * 3, mouse.y * 3, 0);
      for (let i = 0; i < N; i++) {
        const ix=i*3, iy=i*3+1, iz=i*3+2;
        const cur = new THREE.Vector3(pos[ix], pos[iy], pos[iz]);
        const org = new THREE.Vector3(orig[ix], orig[iy], orig[iz]);
        const v   = new THREE.Vector3(vel[ix], vel[iy], vel[iz]);
        const d = cur.distanceTo(mw);
        if (d < 1.5) v.add(new THREE.Vector3().subVectors(cur, mw).normalize().multiplyScalar((1.5 - d) * 0.012));
        v.add(new THREE.Vector3().subVectors(org, cur).multiplyScalar(0.001));
        v.multiplyScalar(0.95);
        pos[ix]+=v.x; pos[iy]+=v.y; pos[iz]+=v.z;
        vel[ix]=v.x;  vel[iy]=v.y;  vel[iz]=v.z;
      }
      geo.attributes.position.needsUpdate = true;
      pts.rotation.y = t * 0.05;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      if (mountRef.current?.contains(renderer.domElement))
        mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};

// ── Hero ─────────────────────────────────────────────────────────
export const WovenLightHero = () => {
  const textCtrl = useAnimation();
  const btnCtrl  = useAnimation();

  const [settings, setSettings] = React.useState({
    heroTitle:    heroCache?.heroTitle    || "Biliklərinizi Test Edin",
    heroBadge:    heroCache?.heroBadge    || "Ulvi Asad — İnteraktiv Təhsil Platforması",
    heroSubtitle: heroCache?.heroSubtitle || "Qanunvericilik, məntiq, Azərbaycan dili, informatika və DQ Qəbul sahələrində quiz və testlərlə özünüzü sınayın. Materiallar yükləyin, məqalələr oxuyun.",
    quizCount:  statsCache?.quizCount  || 0,
    matCount:   statsCache?.matCount   || 0,
    userCount:  statsCache?.userCount  || 0,
  });

  useEffect(() => {
    textCtrl.start((i) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.07 + 0.6, duration: 1, ease: [0.2, 0.65, 0.3, 0.9] },
    }));
    btnCtrl.start({ opacity: 1, transition: { delay: 2, duration: 0.8 } });

    // Cache varsa fetch etmə
    if (!heroCache) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => {
          heroCache = {
            heroTitle:    d.heroTitle    || settings.heroTitle,
            heroBadge:    d.heroBadge    || settings.heroBadge,
            heroSubtitle: d.heroSubtitle || settings.heroSubtitle,
          };
          setSettings((p) => ({ ...p, ...heroCache }));
        })
        .catch(() => {});
    }

    if (!statsCache) {
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d) => {
          statsCache = {
            quizCount:  d.totalQuizzes   || 0,
            matCount:   d.totalMaterials || 0,
            userCount:  d.totalUsers     || 0,
          };
          setSettings((p) => ({ ...p, ...statsCache }));
        })
        .catch(() => {});
    }
  }, [textCtrl, btnCtrl]);

  const headline = settings.heroTitle;

  return (
    <div className="relative flex min-h-[88vh] w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0d2137 0%,#0a3d2e 40%,#0d2137 100%)" }}>

      <WovenCanvas />

      <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(rgba(147,204,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(147,204,255,1) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.6 } }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8"
          style={{ background: "rgba(147,204,255,0.12)", color: "rgb(147,204,255)", border: "1px solid rgba(147,204,255,0.3)" }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {settings.heroBadge}
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight"
          style={{ color: "#ffffff" }}>
          {headline.split(" ").map((word, wi) => (
            <span key={wi} className="inline-block mr-3">
              {word.split("").map((char, ci) => (
                <motion.span key={ci} custom={wi * 6 + ci}
                  initial={{ opacity: 0, y: 40 }} animate={textCtrl}
                  style={{ display: "inline-block" }}>
                  {char}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        <motion.p custom={headline.length + 2}
          initial={{ opacity: 0, y: 24 }} animate={textCtrl}
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed"
          style={{ color: "rgba(147,204,255,0.8)" }}>
          {settings.heroSubtitle}
        </motion.p>

        <motion.div initial={{ opacity: 0 }} animate={btnCtrl}
          className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/quizler" className="btn-primary px-10 py-3.5 text-base">
            Quizlərə Başla
          </Link>
          <Link href="/auth/qeydiyyat"
            className="inline-flex items-center justify-center gap-2 px-10 py-3.5 rounded-[10px] font-semibold text-base transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "rgba(147,204,255,0.1)", color: "rgb(147,204,255)", border: "1.5px solid rgba(147,204,255,0.35)" }}>
            Pulsuz Qeydiyyat
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 2.5, duration: 0.8 } }}
          className="flex items-center justify-center gap-10 mt-14">
          {[
            { val: settings.quizCount  > 0 ? `${settings.quizCount}+`  : "50+",  label: "Quiz & Test" },
            { val: settings.matCount   > 0 ? `${settings.matCount}+`   : "30+",  label: "Material" },
            { val: settings.userCount  > 0 ? `${settings.userCount}+`  : "500+", label: "İstifadəçi" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-extrabold" style={{ color: "rgb(147,204,255)" }}>{s.val}</p>
              <p className="text-xs mt-0.5 font-medium" style={{ color: "rgba(147,204,255,0.5)" }}>{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.p initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 3, duration: 1 } }}
        className="absolute bottom-5 text-xs z-10"
        style={{ color: "rgba(147,204,255,0.35)" }}>
        siçanı hərəkət etdirərək hissəciklərlə qarşılıqlı əlaqə qurun
      </motion.p>
    </div>
  );
};
