import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeRepository } from "@/lib/data/recipes";
import { DeleteRecipeButton } from "./delete-button";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = await getRecipeRepository();
  const recipe = await repo.getBySlug(slug);
  if (!recipe) notFound();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar active="library" signOut={repo.kind === "supabase"} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <Link href="/library" className="text-sm font-medium text-ink-2 hover:text-accent">
            ← Recipe library
          </Link>
        </div>

        <section className="rounded-xl border border-line-2 bg-card p-5 shadow-sm">
          <h1 className=" text-2xl font-semibold">{recipe.name}</h1>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            <span>
              Base <span className="font-semibold text-ink">{recipe.basePortions}</span> portions
            </span>
            <span>
              Portion <span className="font-semibold text-ink">{recipe.portionSize}</span>
            </span>
            {recipe.equipment && <span>Equipment: {recipe.equipment}</span>}
            {recipe.holdingTime && <span>Hold: {recipe.holdingTime}</span>}
          </div>

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {recipe.tags.map((t) => (
                <span key={t} className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                  {t}
                </span>
              ))}
            </div>
          )}

          <h2 className=" mt-5 mb-1.5 text-base font-semibold">Standardized recipe</h2>
          <pre className="font-mono-ui whitespace-pre-wrap rounded-lg border border-line bg-bg p-4 text-sm text-ink-2">
{recipe.recipeText}
          </pre>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={`/app?recipe=${encodeURIComponent(recipe.slug)}`}
              className="inline-block rounded-full bg-accent px-5 py-3 text-sm font-bold text-accent-ink shadow-sm transition"
            >
              Scale this recipe →
            </Link>
            <DeleteRecipeButton id={recipe.id} name={recipe.name} />
          </div>
        </section>
      </main>
    </div>
  );
}
