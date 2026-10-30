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
      <video ref={ref} className="hero-video-media" poster="/media/hero-poster.jpg" autoPlay muted loop playsInline preload="metadata" aria-hidden tabIndex={-1}>
        {/* full-HD on computers, a lighter copy on phones so mobile internet is not strained */}
        <source src="/media/hero-1080.mp4" type="video/mp4" media="(min-width: 900px)" />
        <source src="/media/hero-720.mp4" type="video/mp4" />
      </video>
      <div className="hero-video-scrim" aria-hidden />
      {/* the text sits on dark footage, so this block always uses the dark colour set, even in the light theme */}
      <div className="hero-video-content" data-theme="dark">
        {children}
      </div>
    </section>
  );
}
