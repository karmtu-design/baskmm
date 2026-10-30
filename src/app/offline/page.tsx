export const metadata = { title: "Нет связи" };
export const dynamic = "force-static";

/** Shown by the installed app when there is no internet. Needs no login and no data. */
export default function Offline() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#101820", color: "#f0efec", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="BASK" width={96} height={96} style={{ borderRadius: 20 }} />
        <h1 style={{ fontSize: 24, margin: "20px 0 8px" }}>Нет подключения к интернету</h1>
        <p style={{ color: "#a9adb2", lineHeight: 1.5, margin: 0 }}>
          Данные по лицензиям и проектам загружаются только с сервера и не хранятся на устройстве. Проверьте связь и
          откройте страницу снова.
        </p>
      </div>
    </main>
  );
}
