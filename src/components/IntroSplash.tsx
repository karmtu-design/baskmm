"use client";

import { tr } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { BRAND, INTRO_KEY } from "@/lib/brand";

/**
 * Thin gold "fault lines and mineral veins" that appear first and then gather into the peaks.
 * Fixed seed, so the picture is the same on every visit and on the server and in the browser.
 */
function makeVeins() {
  let s = 20261030;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const veins: string[] = [];
  for (let i = 0; i < 22; i++) {
    let x = 360 + rnd() * 880;
    let y = 330 + rnd() * 320;
    const angle = (rnd() - 0.5) * 1.4 + (rnd() > 0.5 ? 0 : Math.PI);
    const steps = 4 + Math.floor(rnd() * 4);
    let d = `M${x.toFixed(0)},${y.toFixed(0)}`;
    for (let k = 0; k < steps; k++) {
      const len = 30 + rnd() * 70;
      const a = angle + (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len * 0.6;
      d += ` L${x.toFixed(0)},${y.toFixed(0)}`;
    }
    veins.push(d);
  }
  return veins;
}
const VEINS = makeVeins();

/** Outlines of the logo peaks, traced over the approved artwork (coordinates of peaks-light.webp). */
const PEAKS = [
  "M195,262 L415,112 L510,155",
  "M60,333 Q430,300 712,10 Q930,170 1105,305",
  "M870,150 L963,107 Q1210,230 1395,328",
  "M705,153 L1000,328",
];

export default function IntroSplash() {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.intro === "seen" || !root.current) {
      setGone(true);
      return;
    }
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
    html.style.overflow = "hidden";

    const q = gsap.utils.selector(root);
    const finish = () => {
      html.style.overflow = "";
      html.dataset.intro = "seen";
      setGone(true);
    };

    const t = gsap.timeline({ defaults: { ease: "power2.out" }, onComplete: finish });
    tl.current = t;

    // 0–1 s: fault lines and veins appear
    t.fromTo(q(".vein"), { strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1, stagger: 0.025, ease: "power1.inOut" }, 0);
    // 1–2 s: the lines gather into the peaks
    t.to(q(".veins"), { scale: 0.55, opacity: 0, duration: 1, ease: "power2.in", transformOrigin: "50% 45%" }, 1);
    t.fromTo(q(".peak-line"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, stagger: 0.08, ease: "power2.inOut" }, 1);
    t.to(q(".peaks-img"), { opacity: 1, duration: 0.5 }, 1.75);
    t.to(q(".peak-line"), { opacity: 0, duration: 0.5 }, 1.85);
    // 2–3 s: BASK
    t.fromTo(q(".wordmark"), { opacity: 0, y: 18, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 0.9 }, 2.05);
    // 3–4 s: METALS AND MINING
    t.fromTo(q(".tagline"), { opacity: 0, scaleX: 0.92 }, { opacity: 1, scaleX: 1, duration: 0.9 }, 3);
    // 4–5 s: slogan
    t.fromTo(q(".slogan"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.9 }, 4);
    // 5–6 s: metallic glint across the gold peaks
    t.fromTo(q(".shine"), { backgroundPosition: "160% 0" }, { backgroundPosition: "-60% 0", duration: 1, ease: "power1.inOut" }, 5);
    // 6–7 s: the splash fades and reveals the page
    t.to(q(".intro-stage"), { scale: 1.03, duration: 1, ease: "power1.in" }, 6);
    t.to(root.current, { autoAlpha: 0, duration: 0.8, ease: "power1.in" }, 6.2);

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      t.kill();
      html.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function skip() {
    const t = tl.current;
    if (!t || !root.current) return;
    t.pause();
    gsap.to(root.current, {
      autoAlpha: 0,
      duration: 0.35,
      onComplete: () => {
        t.progress(1);
      },
    });
  }

  if (gone) return null;

  return (
    <div ref={root} className="intro" role="dialog" aria-modal="true" aria-label={tr("Заставка {0}", { 0: BRAND.name })}>
      <svg className="veins" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {VEINS.map((d, i) => (
          <path key={i} className="vein" d={d} pathLength={1} />
        ))}
      </svg>

      <div className="intro-stage">
        <div className="intro-logo">
          <div className="peaks">
            <svg viewBox="0 0 1456 345" aria-hidden>
              {PEAKS.map((d, i) => (
                <path key={i} className="peak-line" d={d} pathLength={1} />
              ))}
            </svg>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="peaks-img" src="/brand/peaks-light.webp" alt="" fetchPriority="high" />
            <div className="shine" aria-hidden />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wordmark" src="/brand/wordmark-light.webp" alt="BASK" fetchPriority="high" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tagline" src="/brand/tagline-light.webp" alt="Metals and Mining" fetchPriority="high" />
        </div>
        <p className="slogan">{BRAND.slogan}</p>
      </div>

      <button type="button" className="intro-skip" onClick={skip}>{tr("Пропустить")}</button>
    </div>
  );
}
