import { NextResponse } from "next/server";
import { getRecipeRepository } from "@/lib/data/recipes";

export const dynamic = "force-dynamic";

/** One recipe by slug — used by the scaler to pre-fill from the library. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = await getRecipeRepository();
  const recipe = await repo.getBySlug(slug);
  if (!recipe) return NextResponse.json({ ok: false, error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ ok: true, recipe });
}
