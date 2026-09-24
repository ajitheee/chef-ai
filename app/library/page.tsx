import Link from "next/link";
import { getRecipeRepository } from "@/lib/data/recipes";
import { importStarters, importChefRecipes } from "./actions";
import { TopBar } from "@/components/TopBar";
import { PAGE, H1, H2, CHIP, PRIMARY, TH, TD } from "@/components/paper";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recipe library · Digital Chef AI",
};

export default async function LibraryPage() {
  const repo = await getRecipeRepository();
  const recipes = await repo.list();
  const live = repo.kind === "supabase";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="library" signOut={live} />
      <main className={PAGE}>
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className={H1}>
              Recipe library <span className="text-ink-3">· {recipes.length}</span>
            </h1>
            <p className="mt-1 text-sm text-ink-2">Your standardized recipes. Open one, then scale it to today&apos;s covers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <form action={importChefRecipes}>
              <button className={CHIP}>Import my 4 Centerpointe recipes</button>
            </form>
            <form action={importStarters}>
              <button className={CHIP}>Import the 50-recipe test library</button>
            </form>
            <Link href="/library/new" className={`${PRIMARY} px-4 py-2 text-sm`}>
              New recipe
            </Link>
          </div>
        </header>

        {recipes.length === 0 ? (
          <section className="mt-6 border-t border-ink pt-3">
            <h2 className={H2}>Empty library</h2>
            <p className="mt-2 text-sm text-ink-2">
              Start with your own recipes (<span className="font-semibold text-ink">New recipe</span>), or import a set above to explore.
            </p>
          </section>
        ) : (
          <section className="mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TH}>Recipe</th>
                  <th className={`${TH} hidden sm:table-cell`}>Base</th>
                  <th className={`${TH} hidden sm:table-cell`}>Portion</th>
                  <th className={`${TH} hidden md:table-cell`}>Tags</th>
                  <th className={`${TH} pr-0`} aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {recipes.map((r) => (
                  <tr key={r.id}>
                    <td className={`${TD} font-semibold`}>
                      <Link href={`/library/${r.slug}`} className="underline-offset-2 hover:underline">
                        {r.name}
                      </Link>
                      <span className="block text-xs font-normal text-ink-3 sm:hidden">
                        Base {r.basePortions} · {r.portionSize}
                      </span>
                    </td>
                    <td className={`${TD} hidden whitespace-nowrap sm:table-cell`}>{r.basePortions} portions</td>
                    <td className={`${TD} hidden sm:table-cell`}>{r.portionSize}</td>
                    <td className={`${TD} hidden text-xs text-ink-3 md:table-cell`}>{(r.tags || []).join(" · ")}</td>
                    <td className={`${TD} whitespace-nowrap pr-0 text-right`}>
                      <Link href={`/library/${r.slug}`} className={CHIP}>
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">Imports skip recipes that are already in the library.</p>
          </section>
        )}

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          {live ? "Your database" : "Mock seed · connect Supabase to go live"}
        </p>
      </main>
    </div>
  );
}
