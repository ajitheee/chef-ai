import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeRepository } from "@/lib/data/recipes";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await getRecipeRepository().getBySlug(slug);
  if (!recipe) notFound();

  return (
    <div className="font-techno relative min-h-screen bg-[#FCF3E3] text-[#3A2A1E]">
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        <div className="mb-4">
          <Link href="/library" className="text-xs font-bold uppercase tracking-wide text-[#3A2A1E]/45 hover:text-[#C24E33]">
            ← Recipe library
          </Link>
        </div>

        <section className="rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-5 shadow-[0_10px_0_0_#3A2A1E]">
          <h1 className="font-display text-2xl font-semibold">{recipe.name}</h1>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#3A2A1E]/65">
            <span>
              Base <span className="font-semibold text-[#3A2A1E]">{recipe.basePortions}</span> portions
            </span>
            <span>
              Portion <span className="font-semibold text-[#3A2A1E]">{recipe.portionSize}</span>
            </span>
            {recipe.equipment && <span>Equipment: {recipe.equipment}</span>}
            {recipe.holdingTime && <span>Hold: {recipe.holdingTime}</span>}
          </div>

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {recipe.tags.map((t) => (
                <span key={t} className="rounded-full bg-[#51613A]/12 px-2 py-0.5 text-[11px] font-semibold text-[#51613A]">
                  {t}
                </span>
              ))}
            </div>
          )}

          <h2 className="font-display mt-5 mb-1.5 text-base font-semibold">Standardized recipe</h2>
          <pre className="font-mono-ui whitespace-pre-wrap rounded-2xl border-2 border-[#3A2A1E]/12 bg-[#FCF3E3] p-4 text-sm text-[#3A2A1E]/85">
{recipe.recipeText}
          </pre>

          <Link
            href="/app"
            className="mt-5 inline-block rounded-full bg-[#C24E33] px-5 py-3 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] transition hover:translate-y-0.5 hover:shadow-[0_3px_0_0_#A33E27]"
          >
            Scale this recipe →
          </Link>
        </section>
      </main>
    </div>
  );
}
