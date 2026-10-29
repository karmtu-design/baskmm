import { NextResponse } from "next/server";
import { extractPrices, SOURCE_URL } from "@/lib/metals";

// Public metal prices as read from the source page: used to check that reading still works.
export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { "user-agent": "BASK Metals and Mining portfolio (daily price board)", accept: "text/html" },
      next: { revalidate: 6 * 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `source ${res.status}` }, { status: 502 });
    const prices = extractPrices(await res.text());
    return NextResponse.json({ ok: prices.length > 0, source: SOURCE_URL, prices });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
