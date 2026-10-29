import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="bg-patina-deep px-4 py-4 text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col md:py-6">
        <div className="mb-4 px-3 md:mb-8">
          <div className="text-[15px] font-semibold leading-tight">Bask Metals and Mining</div>
          <div className="mt-0.5 text-xs text-white/60">Портфель недропользования</div>
        </div>
        <Nav />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 px-3 pt-3 text-xs text-white/60 md:mt-auto md:block md:pt-4">
          <div className="truncate">{user?.email}</div>
          <form action={signOut}>
            <button className="mt-2 text-white/80 underline-offset-2 hover:underline">Выйти</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
