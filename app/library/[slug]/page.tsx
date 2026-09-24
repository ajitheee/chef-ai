import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeRepository } from "@/lib/data/recipes";
import { RECIPE_STATUSES } from "@/lib/data/types";
import { setRecipeStatus } from "../actions";
import { DeleteRecipeButton } from "./delete-button";
import { RestoreVersionButton } from "./restore-button";
import { TopBar } from "@/components/TopBar";
import { PRIMARY, LABEL_INLINE, chip, TH, TD, Section } from "@/components/paper";

export const dynamic = "force-dynamic";

const STATUS_HELP: Record<string, string> = {
  Draft: "generated or edited — not yet tested",
  Tested: "a kitchen test recorded the actual yield",
  "Approved Master": "the current production recipe",
};

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = await getRecipeRepository();
  const recipe = await repo.getBySlug(slug);
  if (!recipe) notFound();
  const versions = await repo.versions(recipe.id);
  const status = recipe.status || "Draft";

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

          {/* Lifecycle — the chef's call after a kitchen test. Sheets scaled from a Tested / Approved Master card carry that status. */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className={LABEL_INLINE}>Status</span>
            {RECIPE_STATUSES.map((s) => (
              <form key={s} action={setRecipeStatus}>
                <input type="hidden" name="id" value={recipe.id} />
                <input type="hidden" name="slug" value={recipe.slug} />
                <input type="hidden" name="status" value={s} />
                <button type="submit" className={chip(status === s)} title={STATUS_HELP[s]}>
                  {s}
                </button>
              </form>
            ))}
            <span className="ml-1 text-xs text-ink-3">
              v{recipe.version ?? 1} · {STATUS_HELP[status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            Sheets scaled from a Tested or Approved Master card carry that status instead of Draft. Any edit to the card puts it back to Draft.
          </p>

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

          <Section title="Previous versions" aside={<span className="text-xs text-ink-3">every saved change keeps the one before it</span>}>
            {versions.length === 0 ? (
              <p className="text-sm text-ink-2">None yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH}>Version</th>
                    <th className={TH}>Saved</th>
                    <th className={TH}>Replaced</th>
                    <th className={`${TH} hidden sm:table-cell`}>Base · portion</th>
                    <th className={`${TH} pr-0`} aria-label="Restore" />
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.version}>
                      <td className={`${TD} font-semibold`}>v{v.version}</td>
                      <td className={TD}>{v.savedAt || "—"}</td>
                      <td className={TD}>{v.supersededAt}</td>
                      <td className={`${TD} hidden sm:table-cell`}>
                        {v.basePortions} · {v.portionSize}
                      </td>
                      <td className={`${TD} whitespace-nowrap pr-0 text-right`}>
                        <RestoreVersionButton recipeId={recipe.id} version={v.version} slug={recipe.slug} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </article>
      </main>
    </div>
  );
}
