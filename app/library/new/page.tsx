import Link from "next/link";
import { createRecipe } from "../actions";
import { getRecipeRepository } from "@/lib/data/recipes";

export const dynamic = "force-dynamic";

const label = "block text-sm font-semibold text-[#3A2A1E]/70 mb-1";
const input =
  "w-full rounded-xl border-2 border-[#3A2A1E]/20 bg-[#FFFBF2] px-3 py-2.5 text-base text-[#3A2A1E] placeholder:text-[#3A2A1E]/35 focus:border-[#C24E33] focus:outline-none";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const repo = await getRecipeRepository();

  return (
    <div className="font-techno relative min-h-screen bg-[#FCF3E3] text-[#3A2A1E]">
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        <div className="mb-4">
          <Link href="/library" className="text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45 hover:text-[#C24E33]">
            ← Recipe library
          </Link>
        </div>

        <form action={createRecipe} className="rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_10px_0_0_#3A2A1E]">
          <h1 className="font-display text-2xl font-semibold">New recipe</h1>
          <p className="mt-1 text-sm text-[#3A2A1E]/65">Paste the standardized recipe as it&apos;s written on the card.</p>

          {repo.kind === "mock" && (
            <p className="mt-3 rounded-xl border-2 border-[#E9A93C] bg-[#E9A93C]/15 px-3 py-2 text-xs text-[#3A2A1E]">
              No database connected — a recipe added here lives only until the server restarts. Connect Supabase (see
              DEPLOY.md) to keep your library.
            </p>
          )}

          {error === "missing" && (
            <p className="mt-3 rounded-xl border-2 border-[#B0392A]/30 bg-[#B0392A]/10 px-3 py-2 text-sm font-semibold text-[#B0392A]">
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

          <button className="mt-5 w-full rounded-full bg-[#C24E33] px-4 py-3.5 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] transition hover:translate-y-0.5 hover:shadow-[0_3px_0_0_#A33E27]">
            Save to library →
          </button>
        </form>
      </main>
    </div>
  );
}
