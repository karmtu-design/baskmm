/** BASK Metals and Mining corporate identity. */
export const BRAND = {
  name: "BASK Metals and Mining",
  slogan: "Exploring Resources. Creating Value.",
  graphite: "#101820",
  gold: "#C9A45C",
  silver: "#D9DEE3",
  /**
   * Home page background. Put a photo or video of a mining site into /public/brand and set its path here,
   * for example "/brand/hero.mp4" and "/brand/hero.jpg" (the photo is also the video's first frame).
   * While both are null, the page uses the relief-map pattern.
   */
  heroVideo: null as string | null,
  heroImage: null as string | null,
};

/** sessionStorage key: the full intro plays once per browser session. */
export const INTRO_KEY = "bask-intro-seen";
