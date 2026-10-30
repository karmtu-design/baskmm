"use client";

// Signing documents with a Kazakh electronic signature (ЭЦП) through NCALayer — the official program from
// pki.gov.kz that must be running on the computer (or KAZTOKEN mobile/desktop). The site never sees the key:
// NCALayer asks for the key file/token and the password itself and gives back a signature (detached CMS
// with a time stamp), which is stored next to the document. Client library: sigex-kz/ncalayer-js-client.

type Client = {
  connect: () => Promise<unknown>;
  basicsSignCMS: (storages: unknown, data: Blob | ArrayBuffer | string, params: unknown, signer: unknown, locale?: string) => Promise<string>;
};
type ClientClass = {
  new (): Client;
  basicsStorageAll: unknown;
  basicsCMSParamsDetached: unknown;
  basicsSignerSignAny: unknown;
};

let loading: Promise<ClientClass> | null = null;
function loadClient(): Promise<ClientClass> {
  if (!loading)
    loading = new Promise<ClientClass>((resolve, reject) => {
      const w = window as unknown as { NCALayerClient?: ClientClass };
      if (w.NCALayerClient) return resolve(w.NCALayerClient);
      const s = document.createElement("script");
      s.src = "/vendor/ncalayer-client.js";
      s.onload = () => (w.NCALayerClient ? resolve(w.NCALayerClient) : reject(new Error("NCALayer client did not load")));
      s.onerror = () => reject(new Error("NCALayer client did not load"));
      document.head.appendChild(s);
    }).catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

export class EdsError extends Error {
  constructor(
    message: string,
    public kind: "no-ncalayer" | "cancelled" | "failed"
  ) {
    super(message);
  }
}

/** Returns the signature (Base64 CMS, the document itself not inside). */
export async function signWithNCALayer(file: Blob, locale: "ru" | "kk" | "en" = "ru"): Promise<string> {
  const C = await loadClient();
  const client = new C();
  try {
    await client.connect();
  } catch {
    throw new EdsError("no-ncalayer", "no-ncalayer");
  }
  try {
    return await client.basicsSignCMS(C.basicsStorageAll, file, C.basicsCMSParamsDetached, C.basicsSignerSignAny, locale);
  } catch (e) {
    const err = e as { canceledByUser?: boolean; message?: string };
    if (err.canceledByUser) throw new EdsError("cancelled", "cancelled");
    throw new EdsError(err.message ?? String(e), "failed");
  }
}

export type SignerInfo = { name: string | null; org: string | null; bin: string | null; validTo: string | null; signedAt: string | null };

/** Who signed, read from the certificate inside the signature (the personal ИИН is not kept). */
export async function readSigner(cmsBase64: string): Promise<SignerInfo> {
  const [asn1js, pkijs] = await Promise.all([import("asn1js"), import("pkijs")]);
  const der = Uint8Array.from(atob(cmsBase64.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const asn = asn1js.fromBER(der.buffer);
  const ci = new pkijs.ContentInfo({ schema: asn.result });
  const sd = new pkijs.SignedData({ schema: ci.content });
  const certs = (sd.certificates ?? []).filter((c): c is InstanceType<typeof pkijs.Certificate> => c instanceof pkijs.Certificate);
  // the signer's certificate is the one named in the signer info; otherwise the first non-authority one
  const si = sd.signerInfos[0];
  let cert = certs[0];
  if (si?.sid instanceof pkijs.IssuerAndSerialNumber) {
    const serial = si.sid.serialNumber.valueBlock.valueHexView.join(",");
    cert = certs.find((c) => c.serialNumber.valueBlock.valueHexView.join(",") === serial) ?? cert;
  }
  const attr = (oid: string) => cert?.subject.typesAndValues.find((t) => t.type === oid)?.value.valueBlock.value as string | undefined;
  const cn = attr("2.5.4.3");
  const given = attr("2.5.4.42"); // отчество in Kazakh certificates
  const org = attr("2.5.4.10") ?? null;
  const ou = attr("2.5.4.11") ?? "";
  const bin = ou.match(/BIN(\d{12})/)?.[1] ?? null;
  let signedAt: string | null = null;
  const st = si?.signedAttrs?.attributes.find((a) => a.type === "1.2.840.113549.1.9.5");
  if (st?.values?.[0]) {
    try {
      signedAt = (st.values[0] as unknown as { toDate: () => Date }).toDate().toISOString();
    } catch {
      /* no time inside: the time of saving is used */
    }
  }
  return {
    name: cn ? [cn, given].filter(Boolean).join(" ") : null,
    org,
    bin,
    validTo: cert ? cert.notAfter.value.toISOString() : null,
    signedAt,
  };
}
