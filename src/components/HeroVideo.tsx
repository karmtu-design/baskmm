"use client";

// Background video behind the top of the home page: silent, looped, and paused for people who
// asked their computer for less motion (they see the still picture instead).
import { useEffect, useRef } from "react";

export default function HeroVideo({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (still.matches ? v.pause() : v.play().catch(() => {}));
    apply();
    still.addEventListener("change", apply);
    return () => still.removeEventListener("change", apply);
  }, []);
  return (
    <section className="hero-video">
      <video ref={ref} className="hero-video-media" src="/media/hero.mp4" poster="/media/hero-poster.jpg" autoPlay muted loop playsInline preload="metadata" aria-hidden tabIndex={-1} />
      <div className="hero-video-scrim" aria-hidden />
      {/* the text sits on dark footage, so this block always uses the dark colour set, even in the light theme */}
      <div className="hero-video-content" data-theme="dark">
        {children}
      </div>
    </section>
  );
}
