import Link from "next/link";
import { getRecipeRepository } from "@/lib/data/recipes";
import { importStarters } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recipe library · Digital Chef AI",
};

const chip = "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold";

export default async function LibraryPage() {
  const repo = await getRecipeRepository();
  const recipes = await repo.list();
  const live = repo.kind === "supabase";

  return (
    <div className="font-techno relative min-h-screen bg-[#FCF3E3] text-[#3A2A1E]">
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-4">
            <Link href="/" className="text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45 hover:text-[#C24E33]">
              ← Home
            </Link>
            <Link href="/app" className="text-xs font-bold uppercase tracking-wide text-[#51613A] hover:text-[#3f4d2d]">
              Production scaler →
            </Link>
            {live && (
              <form action="/auth/signout" method="post" className="ml-auto">
                <button className="text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45 hover:text-[#C24E33]">Sign out</button>
              </form>
            )}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold">
                Your recipe library <span className="text-[#C24E33]">· {recipes.length}</span>
              </h1>
              <p className="mt-1 text-sm text-[#3A2A1E]/65">
                Your standardized recipes. Tap one to open it, then scale it to today&apos;s covers.
              </p>
            </div>
            <Link href="/library/new" className={`${chip} border-[#C24E33] bg-[#C24E33] text-[#FCF3E3] hover:bg-[#A33E27]`}>
              + New recipe
            </Link>
          </div>
        </header>

        {recipes.length === 0 && (
          <section className="mb-6 rounded-3xl border-2 border-dashed border-[#3A2A1E]/30 bg-[#FFFBF2] p-5 text-sm text-[#3A2A1E]/70">
            <p>Your library is empty.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/library/new" className={`${chip} border-[#51613A] text-[#51613A] hover:bg-[#51613A]/10`}>
                Add a recipe
              </Link>
              <form action={importStarters}>
                <button className={`${chip} border-[#E9A93C] bg-[#E9A93C]/30 text-[#8a5a12] hover:bg-[#E9A93C]/50`}>
                  Import the 50 starter recipes
                </button>
              </form>
            </div>
          </section>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/library/${r.slug}`}
                className="block h-full rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-4 shadow-[0_6px_0_0_#3A2A1E] transition hover:translate-y-0.5 hover:shadow-[0_3px_0_0_#3A2A1E]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-semibold">{r.name}</span>
                  <span className="whitespace-nowrap text-xs font-bold text-[#C24E33]">open →</span>
                </div>
                <p className="mt-1 text-xs text-[#3A2A1E]/60">
                  Base {r.basePortions} portions · {r.portionSize}
                </p>
                {r.tags && r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full bg-[#51613A]/12 px-2 py-0.5 text-[11px] font-semibold text-[#51613A]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-wide text-[#3A2A1E]/35">
          Structured data layer · {live ? "your database" : "mock seed · connect Supabase to go live"}
        </p>
      </main>
    </div>
  );
}
