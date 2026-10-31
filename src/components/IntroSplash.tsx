"use client";

// The «Керн» intro: a drill core runs through the strata, stops on the copper and gold interval
// and its layers fold into the A of the BASK logo. Plays once per browser session, without sound
// unless the visitor turns it on (browsers do not allow sound before a click).
import { tr } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { BRAND, INTRO_KEY } from "@/lib/brand";

export default function IntroSplash() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sound, setSound] = useState(false);

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
    const v = video.current!;
    let started = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setLeaving(true);
      setTimeout(() => {
        html.style.overflow = "";
        html.dataset.intro = "seen";
        setGone(true);
      }, 650);
    };
    const onPlaying = () => (started = true);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("ended", finish);
    v.addEventListener("error", finish);
    v.play().catch(finish); // e.g. power-saving mode on a phone: no intro, straight to the page
    // a slow connection should not keep people waiting in front of a blank screen
    const slow = setTimeout(() => !started && finish(), 3500);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    (root.current as HTMLDivElement & { finish?: () => void }).finish = finish;
    return () => {
      clearTimeout(slow);
      window.removeEventListener("keydown", onKey);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("ended", finish);
      v.removeEventListener("error", finish);
      html.style.overflow = "";
    };
  }, []);

  function skip() {
    (root.current as (HTMLDivElement & { finish?: () => void }) | null)?.finish?.();
  }
  function toggleSound() {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) v.volume = 0.8;
    setSound(!v.muted);
  }

  if (gone) return null;

  return (
    <div ref={root} className={`intro${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label={tr("Заставка {0}", { 0: BRAND.name })}>
      <video ref={video} className="intro-video" muted playsInline preload="auto" poster="/media/intro-poster.jpg" aria-hidden tabIndex={-1}>
        {/* full 4K on large screens, a light copy everywhere else */}
        <source src="/media/intro-4k.mp4" type="video/mp4" media="(min-width: 2200px)" />
        <source src="/media/intro-1080.mp4" type="video/mp4" />
      </video>
      <div className="intro-buttons">
        <button type="button" className="intro-skip" onClick={toggleSound} aria-pressed={sound}>
          {sound ? tr("Без звука") : tr("Со звуком")}
        </button>
        <button type="button" className="intro-skip" onClick={skip}>
          {tr("Пропустить")}
        </button>
      </div>
    </div>
  );
}
