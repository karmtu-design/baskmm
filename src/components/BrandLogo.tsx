import Link from "next/link";

/**
 * The approved BASK Metals and Mining logo. On a dark theme the graphite parts are shown light,
 * on a light theme the original colours are used. The picture itself is never redrawn.
 */
export default function BrandLogo({ href, height = 40 }: { href?: string; height?: number }) {
  const img = (
    <span className="brand-logo" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo-on-dark" src="/brand/full-light.webp" alt="BASK Metals and Mining" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo-on-light" src="/brand/full-dark.webp" alt="" aria-hidden />
    </span>
  );
  return href ? (
    <Link href={href} aria-label="BASK Metals and Mining, на главную" style={{ display: "inline-flex" }}>
      {img}
    </Link>
  ) : (
    img
  );
}
