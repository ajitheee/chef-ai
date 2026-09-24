import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeRepository } from "@/lib/data/recipes";
import { DeleteRecipeButton } from "./delete-button";
import { TopBar } from "@/components/TopBar";
import { PRIMARY, Section } from "@/components/paper";

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
      <main className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        <Link href="/library" className="text-sm font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          ← Recipe library
        </Link>

        <article className="mt-4">
          <h1 className="text-2xl font-semibold leading-tight">{recipe.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            Base <span className="font-semibold text-ink">{recipe.basePortions}</span> portions · Portion{" "}
            <span className="font-semibold text-ink">{recipe.portionSize}</span>
            {recipe.equipment && <> · Equipment: {recipe.equipment}</>}
            {recipe.holdingTime && <> · Hold: {recipe.holdingTime}</>}
          </p>
          {recipe.tags && recipe.tags.length > 0 && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">{recipe.tags.join(" · ")}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <Link href={`/app?recipe=${encodeURIComponent(recipe.slug)}`} className={`${PRIMARY} px-4 py-2 text-sm`}>
              Scale this recipe →
            </Link>
            <DeleteRecipeButton id={recipe.id} name={recipe.name} />
          </div>

          <Section title="Standardized recipe">
            <pre className="font-mono-ui whitespace-pre-wrap border-b border-ink bg-card px-3 py-3 text-sm text-ink">
{recipe.recipeText}
            </pre>
          </Section>
        </article>
      </main>
    </div>
  );
}
