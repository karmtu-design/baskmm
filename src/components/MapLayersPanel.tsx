"use client";

import { tr } from "@/i18n";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Heading, Row, Text } from "@once-ui-system/core";
import { createClient } from "@/lib/supabase/client";
import { GK_ZONES, UTM_ZONES, crsFromKey } from "@/lib/geoImport";
import type { MapImage } from "@/lib/types";
import { addOverlay, deleteOverlay, setOverlayOpacity } from "@/app/(app)/licenses/overlayActions";

/** Geological maps (GeoTIFF) laid on the licence map: upload, show or hide, transparency, delete. */
export default function MapLayersPanel({
  licenseId,
  images,
  shown,
  onShown,
}: {
  licenseId: number;
  images: MapImage[];
  shown: Record<number, number | false>; // id → opacity when shown, false when hidden
  onShown: (s: Record<number, number | false>) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [needCrs, setNeedCrs] = useState<number | null | false>(false);
  const [crs, setCrs] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  async function upload(f: File, manual?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const { readGeoTiff } = await import("@/lib/geotiffOverlay");
      const r = await readGeoTiff(f, manual ? crsFromKey(manual) : undefined);
      if ("needCrs" in r) {
        setNeedCrs(r.epsg);
        setBusy(false);
        return;
      }
      const supabase = createClient();
      const path = `overlays/lic-${licenseId}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from("documents").upload(path, r.blob, { contentType: "image/webp" });
      if (error) throw new Error(error.message);
      const s = await addOverlay(licenseId, title || f.name.replace(/\.[^.]+$/, ""), path, r.corners, r.crsName);
      if (!s.ok) {
        await supabase.storage.from("documents").remove([path]);
        throw new Error(s.message);
      }
      setMsg({ ok: true, text: tr("Карта добавлена ({0}, {1}×{2} пикс.).", { 0: r.crsName, 1: r.width, 2: r.height }) });
      setFile(null);
      setTitle("");
      setNeedCrs(false);
      setCrs("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: tr("Не получилось: {0}", { 0: (e as Error).message }) });
    }
    setBusy(false);
  }

  function opacity(id: number, v: number) {
    onShown({ ...shown, [id]: v });
    clearTimeout(saveTimer.current[id]);
    saveTimer.current[id] = setTimeout(() => setOverlayOpacity(id, v), 600);
  }

  return (
    <Column background="surface" border radius="l" padding="24" gap="16">
      <Heading as="h2" variant="heading-strong-m">{tr("Геологические карты на подложке")}</Heading>
      {images.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Добавьте карту в формате GeoTIFF (с привязкой к координатам): геологическую карту, карту фактического материала, космоснимок. Она ляжет под контуры участков.")}</Text>
      ) : (
        <ul className="layer-list">
          {images.map((img) => {
            const on = shown[img.id] !== false;
            const op = typeof shown[img.id] === "number" ? (shown[img.id] as number) : img.opacity;
            return (
              <li key={img.id}>
                <label className="layer-name">
                  <input type="checkbox" checked={on} onChange={() => onShown({ ...shown, [img.id]: on ? false : op })} />
                  <span>
                    {img.title}
                    {img.crs && <small>{img.crs}</small>}
                  </span>
                </label>
                <Row gap="8" vertical="center">
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={op}
                    disabled={!on}
                    onChange={(e) => opacity(img.id, Number(e.target.value))}
                    aria-label={tr("Прозрачность: {0}", { 0: img.title })}
                    className="layer-range"
                  />
                  <Button
                    size="s"
                    variant="tertiary"
                    prefixIcon="trash"
                    aria-label={tr("Удалить карту {0}", { 0: img.title })}
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteOverlay(img.id);
                        if (!r.ok) setMsg({ ok: false, text: r.message ?? tr("Ошибка") });
                        router.refresh();
                      })
                    }
                  />
                </Row>
              </li>
            );
          })}
        </ul>
      )}

      <Column gap="8">
        <input
          ref={input}
          type="file"
          accept=".tif,.tiff,.geotiff"
          className="field"
          aria-label={tr("Файл GeoTIFF")}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setNeedCrs(false);
            setMsg(null);
            if (f) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
        {file && (
          <>
            <label className="field-label">{tr("Название карты")}<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {needCrs !== false && (
              <label className="field-label">
                {needCrs ? tr("Система координат файла не распознана (EPSG:{0}). Выберите её:", { 0: needCrs }) : tr("В файле не указана система координат. Выберите её:")}
                <select className="field" value={crs} onChange={(e) => setCrs(e.target.value)}>
                  <option value="" disabled>{tr("Выберите систему координат")}</option>
                  <option value="wgs84">{tr("WGS-84, градусы")}</option>
                  <optgroup label={tr("СК-42, Гаусс–Крюгер (номер зоны в начале X)")}>
                    {GK_ZONES.map((z) => (
                      <option key={z} value={`gk:${z}:1`}>{tr("Зона")}{" "}{z}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={tr("СК-42, Гаусс–Крюгер (без номера зоны)")}>
                    {GK_ZONES.map((z) => (
                      <option key={z} value={`gk:${z}:0`}>{tr("Зона")}{" "}{z}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="WGS-84 / UTM">
                    {UTM_ZONES.map((z) => (
                      <option key={z} value={`utm:${z}`}>
                        UTM {z}N
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            )}
            <Row>
              <Button
                size="s"
                prefixIcon="upload"
                loading={busy}
                disabled={needCrs !== false && !crs}
                onClick={() => upload(file, needCrs !== false ? crs : undefined)}
              >{tr("Добавить на карту")}</Button>
            </Row>
          </>
        )}
        {msg && (
          <Text variant="body-default-s" onBackground={msg.ok ? "success-strong" : "danger-strong"} role={msg.ok ? "status" : "alert"}>
            {msg.text}
          </Text>
        )}
        <Text variant="body-default-xs" onBackground="neutral-weak">{tr("Большие карты уменьшаются до 2048 пикселей по длинной стороне. Исходный файл можно сохранить во вкладке «Исторические данные».")}</Text>
      </Column>
    </Column>
  );
}
