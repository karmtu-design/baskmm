import { BRAND } from "@/lib/brand";
import { signIn } from "./actions";

const field =
  "mt-1.5 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/35 focus:border-[#C9A45C] focus:outline-none";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#101820] text-[#D9DEE3]">
      {/* background: a mining-site video or photo when provided, otherwise the relief-map pattern */}
      <div aria-hidden className="absolute inset-0">
        {BRAND.heroVideo ? (
          <video
            className="h-full w-full object-cover opacity-45"
            src={BRAND.heroVideo}
            poster={BRAND.heroImage ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : BRAND.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover opacity-45" src={BRAND.heroImage} alt="" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover opacity-90" src="/brand/topo.svg" alt="" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(16,24,32,0.15)_0%,rgba(16,24,32,0.8)_75%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/full-light.webp" alt={BRAND.name} className="h-10 w-auto md:h-12" />
        <span className="hidden text-sm text-white/55 sm:block">Внутренняя система группы</span>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 md:min-h-[calc(100vh-96px)] md:grid-cols-[1fr_380px] md:px-8 md:pb-24 md:pt-0">
        <section>
          <h1 className="font-['Jost_Variable'] text-[clamp(36px,7vw,84px)] font-medium leading-[0.98] tracking-[0.04em] text-white">
            BASK
            <span className="block text-[0.42em] font-normal tracking-[0.32em] text-[#D9DEE3]">
              METALS AND MINING
            </span>
          </h1>
          <div aria-hidden className="mt-8 h-px w-24 bg-[#C9A45C]" />
          <p className="mt-6 font-['Jost_Variable'] text-[clamp(18px,2.4vw,26px)] font-light tracking-[0.04em] text-[#C9CED4]">
            {BRAND.slogan}
          </p>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/55">
            Портфель недропользования группы: лицензии на разведку и добычу, контуры участков, документы и задачи
            сотрудников.
          </p>
        </section>

        <form
          action={signIn}
          className="w-full rounded-xl border border-white/10 bg-[#101820]/70 p-7 backdrop-blur-md"
        >
          <h2 className="text-lg font-semibold text-white">Вход для сотрудников</h2>

          <label className="mt-5 block text-sm" htmlFor="email">
            Электронная почта
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={field} />

          <label className="mt-4 block text-sm" htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={field}
          />

          {error && (
            <p className="mt-4 text-sm text-[#E39A8B]" role="alert">
              Неверная почта или пароль. Проверьте раскладку клавиатуры и попробуйте снова.
            </p>
          )}

          <button className="mt-6 w-full rounded-md bg-[#C9A45C] px-4 py-2.5 font-medium text-[#101820] hover:bg-[#D8B672]">
            Войти
          </button>
          <p className="mt-4 text-xs text-white/45">
            Доступ выдаёт администратор системы. Если у вас нет учётной записи, обратитесь к нему.
          </p>
        </form>
      </main>
    </div>
  );
}
