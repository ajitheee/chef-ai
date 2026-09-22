import Link from "next/link";
import { createRecipe } from "../actions";
import { getRecipeRepository } from "@/lib/data/recipes";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

const label = "block text-sm font-semibold text-ink-2 mb-1";
const input =
  "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const repo = await getRecipeRepository();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="library" signOut={repo.kind === "supabase"} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <Link href="/library" className="text-sm font-medium text-ink-2 hover:text-accent">
            ← Recipe library
          </Link>
        </div>

        <form action={createRecipe} className="rounded-xl border border-line-2 bg-card p-5 shadow-sm">
          <h1 className=" text-2xl font-semibold">New recipe</h1>
          <p className="mt-1 text-sm text-ink-2">Paste the standardized recipe as it&apos;s written on the card.</p>

          {repo.kind === "mock" && (
            <p className="mt-3 rounded-xl border border-warn bg-warn-soft px-3 py-2 text-xs text-ink">
              No database connected — a recipe added here lives only until the server restarts. Connect Supabase (see
              DEPLOY.md) to keep your library.
            </p>
          )}

          {error === "missing" && (
            <p className="mt-3 rounded-xl border border-danger bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
              Name, recipe, base portions and portion size are required.
            </p>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className={label} htmlFor="name">Recipe name</label>
              <input id="name" name="name" required className={input} placeholder="Chicken Jambalaya" />
            </div>
            <div>
              <label className={label} htmlFor="recipeText">Recipe (ingredients + method)</label>
              <textarea id="recipeText" name="recipeText" required rows={12} className={`${input} font-mono-ui`} placeholder={"Chicken Jambalaya\n- 10 lb chicken thigh, diced\n- 2 lb andouille, sliced\n...\n\nMethod: ..."} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="basePortions">Base portions</label>
                <input id="basePortions" name="basePortions" required inputMode="numeric" className={input} placeholder="50" />
              </div>
              <div>
                <label className={label} htmlFor="portionSize">Portion size</label>
                <input id="portionSize" name="portionSize" required className={input} placeholder="6 oz" />
              </div>
              <div>
                <label className={label} htmlFor="tags">Tags (comma-separated)</label>
                <input id="tags" name="tags" className={input} placeholder="entree, cajun" />
              </div>
              <div className="col-span-2">
                <label className={label} htmlFor="equipment">Equipment (optional)</label>
                <input id="equipment" name="equipment" className={input} placeholder="tilt skillet, combi" />
              </div>
              <div>
                <label className={label} htmlFor="holdingTime">Hold time (optional)</label>
                <input id="holdingTime" name="holdingTime" className={input} placeholder="2 hours" />
              </div>
            </div>
          </div>

          <button className="mt-5 w-full rounded-full bg-accent px-4 py-3.5 text-sm font-bold text-accent-ink shadow-sm transition">
            Save to library →
          </button>
        </form>
      </main>
    </div>
  );
}
