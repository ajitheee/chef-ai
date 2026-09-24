import Link from "next/link";
import { createRecipe } from "../actions";
import { getRecipeRepository } from "@/lib/data/recipes";
import { TopBar } from "@/components/TopBar";
import { H1, LABEL, FIELD, PRIMARY, NOTE_WARN, NOTE_DANGER } from "@/components/paper";

export const dynamic = "force-dynamic";

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
      <main className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        <Link href="/library" className="text-sm font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          ← Recipe library
        </Link>

        <form action={createRecipe} className="mt-4">
          <h1 className={H1}>New recipe</h1>
          <p className="mt-1 text-sm text-ink-2">Paste the standardized recipe as it&apos;s written on the card.</p>

          {repo.kind === "mock" && (
            <p className={`${NOTE_WARN} mt-3`}>
              No database connected — a recipe added here lives only until the server restarts. Connect Supabase (see DEPLOY.md) to keep your library.
            </p>
          )}

          {error === "missing" && (
            <p className={`${NOTE_DANGER} mt-3`}>Name, recipe, base portions and portion size are required.</p>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className={LABEL} htmlFor="name">Recipe name</label>
              <input id="name" name="name" required className={`${FIELD} font-semibold`} placeholder="Chicken Jambalaya" />
            </div>
            <div>
              <label className={LABEL} htmlFor="recipeText">Recipe — as written on the card</label>
              <textarea id="recipeText" name="recipeText" required rows={12} className={`${FIELD} font-mono-ui text-sm`} placeholder={"Chicken Jambalaya\n- 10 lb chicken thigh, diced\n- 2 lb andouille, sliced\n...\n\nMethod: ..."} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="basePortions">Base portions</label>
                <input id="basePortions" name="basePortions" required inputMode="numeric" className={FIELD} placeholder="50" />
              </div>
              <div>
                <label className={LABEL} htmlFor="portionSize">Portion size</label>
                <input id="portionSize" name="portionSize" required className={FIELD} placeholder="6 oz" />
              </div>
              <div>
                <label className={LABEL} htmlFor="tags">Tags</label>
                <input id="tags" name="tags" className={FIELD} placeholder="entree, cajun" />
              </div>
              <div className="col-span-2">
                <label className={LABEL} htmlFor="equipment">Equipment</label>
                <input id="equipment" name="equipment" className={FIELD} placeholder="tilt skillet, combi" />
              </div>
              <div>
                <label className={LABEL} htmlFor="holdingTime">Hold time</label>
                <input id="holdingTime" name="holdingTime" className={FIELD} placeholder="2 hours" />
              </div>
            </div>
          </div>

          <button className={`${PRIMARY} mt-5 w-full py-3.5 text-base`}>Save to library →</button>
        </form>
      </main>
    </div>
  );
}
