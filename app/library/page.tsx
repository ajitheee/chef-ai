import Link from "next/link";
import { getRecipeRepository } from "@/lib/data/recipes";
import { importStarters, importChefRecipes } from "./actions";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recipe library · Digital Chef AI",
};

const chip = "rounded-full border px-3.5 py-1.5 text-xs font-bold";

export default async function LibraryPage() {
  const repo = await getRecipeRepository();
  const recipes = await repo.list();
  const live = repo.kind === "supabase";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="library" signOut={live} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className=" text-3xl font-semibold">
                Your recipe library <span className="text-accent">· {recipes.length}</span>
              </h1>
              <p className="mt-1 text-sm text-ink-2">
                Your standardized recipes. Tap one to open it, then scale it to today&apos;s covers.
              </p>
            </div>
            <Link href="/library/new" className={`${chip} border-accent bg-accent text-accent-ink hover:bg-accent-hover`}>
              + New recipe
            </Link>
          </div>
        </header>

        {recipes.length === 0 ? (
          <section className="mb-6 rounded-xl border border-dashed border-line bg-card p-5 text-sm text-ink-2">
            <p>Your library is empty. Start with your own recipes, or load the test library to explore.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={importChefRecipes}>
                <button className={`${chip} border-accent bg-accent-soft text-accent hover:bg-accent-soft`}>
                  Import my 4 Centerpointe recipes
                </button>
              </form>
              <form action={importStarters}>
                <button className={`${chip} border-warn bg-warn-soft text-warn hover:bg-warn-soft`}>
                  Import the 50-recipe test library
                </button>
              </form>
              <Link href="/library/new" className={`${chip} border-success text-success hover:bg-success-soft`}>
                Add a recipe by hand
              </Link>
            </div>
          </section>
        ) : (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="font-semibold">Import:</span>
            <form action={importChefRecipes}>
              <button className="rounded-full border border-accent px-3 py-1 text-xs font-bold text-accent hover:bg-accent-soft">
                my 4 Centerpointe recipes
              </button>
            </form>
            <form action={importStarters}>
              <button className="rounded-full border border-warn px-3 py-1 text-xs font-bold text-warn hover:bg-warn-soft">
                the 50-recipe test library
              </button>
            </form>
            <span>(already-imported recipes are skipped)</span>
          </div>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/library/${r.slug}`}
                className="block h-full rounded-xl border border-line-2 bg-card p-4 shadow-sm transition"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className=" text-lg font-semibold">{r.name}</span>
                  <span className="whitespace-nowrap text-xs font-bold text-accent">open →</span>
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  Base {r.basePortions} portions · {r.portionSize}
                </p>
                {r.tags && r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          Structured data layer · {live ? "your database" : "mock seed · connect Supabase to go live"}
        </p>
      </main>
    </div>
  );
}
