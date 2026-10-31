import { tr } from "@/i18n";
import Link from "next/link";

/**
 * The BASK Metals and Mining logo (the A made of rock, copper and gold layers).
 * "mark" is the word BASK alone, for small places like the header; "full" adds METALS AND MINING.
 * On a dark theme the graphite parts are shown light; copper and gold always stay the same.
 */
export default function BrandLogo({ href, height = 40, variant = "mark" }: { href?: string; height?: number; variant?: "mark" | "full" }) {
  const img = (
    <span className="brand-logo" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo-on-dark" src={`/brand/logo-${variant}-on-dark.svg`} alt="BASK Metals and Mining" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo-on-light" src={`/brand/logo-${variant}-on-light.svg`} alt="" aria-hidden />
    </span>
  );
  return href ? (
    <Link href={href} aria-label={tr("BASK Metals and Mining, на главную")} style={{ display: "inline-flex" }}>
      {img}
    </Link>
  ) : (
    img
  );
}
