export const metadata = { title: "Нет связи · No connection · 无网络连接" };
export const dynamic = "force-static";

/** Shown by the installed app when there is no internet. Needs no login and no data, so it is in all three languages. */
export default function Offline() {
  const p = { color: "#a9adb2", lineHeight: 1.5, margin: "0 0 14px" } as const;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#101820", color: "#f0efec", textAlign: "center" }}>
      <div style={{ maxWidth: 440 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="BASK" width={96} height={96} style={{ borderRadius: 20 }} />
        <h1 style={{ fontSize: 22, margin: "20px 0 12px" }}>Нет подключения к интернету</h1>
        <p style={p}>Данные по лицензиям и проектам загружаются только с сервера и не хранятся на устройстве. Проверьте связь и откройте страницу снова.</p>
        <p style={p} lang="en">No internet connection. Licence and project data are loaded from the server only and are not stored on this device.</p>
        <p style={p} lang="zh">无网络连接。许可证和项目数据仅从服务器加载，不会保存在本设备上。</p>
      </div>
    </main>
  );
}
