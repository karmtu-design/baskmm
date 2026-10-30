"use client";

// «Подписать ЭЦП» on a document and the list of its signatures (who, which company, when),
// with the signature file to download and a link to the official check on ezsigner.kz.
import { useState } from "react";
import { tr, loc, currentLocale } from "@/i18n";
import { createClient } from "@/lib/supabase/client";

export type DocSignature = { id: number; document_id: number; signer_name: string | null; signer_org: string | null; signer_bin: string | null; signed_at: string; created_by: string | null };

const when = (iso: string) => new Date(iso).toLocaleString(loc(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" });

export function SignButton({ documentId, getFile, onSigned }: { documentId: number; getFile: () => Promise<Blob>; onSigned: () => void }) {
  const [step, setStep] = useState("");
  const [err, setErr] = useState("");

  async function sign() {
    setErr("");
    try {
      setStep(tr("готовлю файл…"));
      const file = await getFile();
      setStep(tr("подтвердите подпись в окне NCALayer…"));
      const { signWithNCALayer, readSigner } = await import("@/lib/eds");
      const l = currentLocale();
      const cms = await signWithNCALayer(file, l === "en" ? "en" : "ru");
      setStep(tr("сохраняю подпись…"));
      const who = await readSigner(cms).catch(() => null);
      const supabase = createClient();
      const { data: s } = await supabase.auth.getSession();
      const { error } = await supabase.from("signatures").insert({
        document_id: documentId,
        cms,
        signer_name: who?.name ?? null,
        signer_org: who?.org ?? null,
        signer_bin: who?.bin ?? null,
        cert_valid_to: who?.validTo ?? null,
        signed_at: who?.signedAt ?? new Date().toISOString(),
        created_by: s.session?.user.email ?? null,
      });
      if (error) throw new Error(error.message);
      setStep("");
      onSigned();
    } catch (e) {
      setStep("");
      const kind = (e as { kind?: string }).kind;
      setErr(
        kind === "no-ncalayer"
          ? tr("Не удалось связаться с NCALayer. Запустите NCALayer на этом компьютере (скачать: ncl.pki.gov.kz) и нажмите ещё раз. На телефоне подпись через NCALayer недоступна.")
          : kind === "cancelled"
            ? tr("Подписание отменено.")
            : tr("Не подписалось: {0}", { 0: (e as Error).message })
      );
    }
  }

  return (
    <span className="eds-sign">
      <button type="button" className="chip" onClick={sign} disabled={!!step} title={tr("Подписать документ своей ЭЦП через NCALayer")}>
        ✍ {step || tr("Подписать ЭЦП")}
      </button>
      {err && <span className="eds-err">{err}</span>}
    </span>
  );
}

export function SignatureList({ list, fileName, canDelete, onChanged }: { list: DocSignature[]; fileName: string; canDelete: boolean; onChanged: () => void }) {
  if (!list.length) return null;
  async function download(s: DocSignature) {
    const { data } = await createClient().from("signatures").select("cms").eq("id", s.id).single();
    if (!data?.cms) return;
    const bytes = Uint8Array.from(atob(data.cms), (c) => c.charCodeAt(0));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pkcs7-signature" }));
    a.download = `${fileName}.${(s.signer_name ?? "signature").replace(/[\\/:*?"<>|\s]+/g, "_")}.cms`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function remove(s: DocSignature) {
    if (!confirm(tr("Убрать подпись {0} из системы? Сам документ не изменится.", { 0: s.signer_name ?? "" }))) return;
    const { data, error } = await createClient().from("signatures").delete().eq("id", s.id).select("id");
    if (error) alert(error.message);
    else if (!data?.length) alert(tr("Убрать подпись могут редакторы и администраторы."));
    onChanged();
  }
  return (
    <ul className="eds-list">
      {list.map((s) => (
        <li key={s.id}>
          <span className="eds-mark" aria-hidden>
            ✍
          </span>
          <span>
            <b>{s.signer_name ?? tr("Подпись")}</b>
            {s.signer_org && (
              <>
                {" · "}
                {s.signer_org}
                {s.signer_bin && ` (${tr("БИН {0}", { 0: s.signer_bin })})`}
              </>
            )}
            <span className="eds-time"> · {when(s.signed_at)}</span>
          </span>
          <button type="button" className="eds-link" onClick={() => download(s)}>
            {tr("файл подписи (.cms)")}
          </button>
          <a className="eds-link" href="https://ezsigner.kz/" target="_blank" rel="noreferrer" title={tr("Загрузите на ezsigner.kz документ и файл подписи (.cms): сервис НУЦ РК покажет, действительна ли подпись")}>
            {tr("проверить на ezsigner.kz")}
          </a>
          {canDelete && (
            <button type="button" className="eds-link" onClick={() => remove(s)}>
              {tr("убрать")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
