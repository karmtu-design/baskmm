"use client";

// The «Керн» intro: a drill core runs through the strata, stops on the copper and gold interval
// and its layers fold into the A of the BASK logo. Plays once per browser session, with sound.
import { tr } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { BRAND, INTRO_KEY } from "@/lib/brand";

export default function IntroSplash() {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
    // sound is on by default; browsers that forbid sound before a click (Safari on iPhone, for one)
    // start the video silently and the sound comes on at the first touch, click or key press
    const unmute = () => {
      v.muted = false;
      v.volume = 0.8;
      off();
    };
    const evs = ["pointerdown", "touchstart", "keydown"] as const;
    const off = () => evs.forEach((e) => window.removeEventListener(e, unmute));
    const onPlaying = () => (started = true);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("ended", finish);
    v.addEventListener("error", finish);
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      evs.forEach((e) => window.addEventListener(e, unmute, { passive: true }));
      v.play().catch(finish); // e.g. power-saving mode on a phone: no intro, straight to the page
    });
    // a slow connection should not keep people waiting in front of a blank screen
    const slow = setTimeout(() => !started && finish(), 3500);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(slow);
      off();
      window.removeEventListener("keydown", onKey);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("ended", finish);
      v.removeEventListener("error", finish);
      html.style.overflow = "";
    };
  }, []);

  if (gone) return null;

  return (
    <div ref={root} className={`intro${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label={tr("Заставка {0}", { 0: BRAND.name })}>
      <video ref={video} className="intro-video" playsInline preload="auto" aria-hidden tabIndex={-1}>
        {/* a vertical cut for phones held upright, full 4K on large screens, a light copy everywhere else */}
        <source src="/media/intro-portrait.mp4" type="video/mp4" media="(max-aspect-ratio: 4/5)" />
        <source src="/media/intro-4k.mp4" type="video/mp4" media="(min-width: 2200px)" />
        <source src="/media/intro-1080.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
