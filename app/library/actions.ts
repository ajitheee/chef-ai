"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRecipeRepository, STARTER_RECIPES, CHEF_RECIPES } from "@/lib/data/recipes";
import { RECIPE_STATUSES, type RecipeStatus } from "@/lib/data/types";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createRecipe(formData: FormData) {
  const name = text(formData, "name");
  const recipeText = text(formData, "recipeText");
  const basePortions = Number(text(formData, "basePortions"));
  const portionSize = text(formData, "portionSize");
  if (!name || !recipeText || !(basePortions > 0) || !portionSize) {
    redirect("/library/new?error=missing");
  }
  const tags = text(formData, "tags")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const repo = await getRecipeRepository();
  const recipe = await repo.create({
    name,
    recipeText,
    basePortions,
    portionSize,
    equipment: text(formData, "equipment") || undefined,
    holdingTime: text(formData, "holdingTime") || undefined,
    tags,
  });
  revalidatePath("/library");
  redirect(`/library/${recipe.slug}`);
}

export async function deleteRecipe(formData: FormData) {
  const id = text(formData, "id");
  if (id) {
    const repo = await getRecipeRepository();
    await repo.remove(id);
  }
  revalidatePath("/library");
  redirect("/library");
}

export async function importStarters() {
  const repo = await getRecipeRepository();
  await repo.importMany(STARTER_RECIPES);
  revalidatePath("/library");
}

export async function importChefRecipes() {
  const repo = await getRecipeRepository();
  await repo.importMany(CHEF_RECIPES);
  revalidatePath("/library");
}

/** Lifecycle: Draft → Tested → Approved Master (the chef's call, after a kitchen test). */
export async function setRecipeStatus(formData: FormData) {
  const id = text(formData, "id");
  const slug = text(formData, "slug");
  const status = text(formData, "status");
  if (id && (RECIPE_STATUSES as readonly string[]).includes(status)) {
    const repo = await getRecipeRepository();
    await repo.setStatus(id, status as RecipeStatus);
  }
  revalidatePath("/library");
  if (slug) revalidatePath(`/library/${slug}`);
}

/** Put a prior version back (the current one is kept as a version; the recipe returns to Draft). */
export async function restoreRecipeVersion(formData: FormData) {
  const id = text(formData, "id");
  const slug = text(formData, "slug");
  const version = Number(text(formData, "version"));
  if (id && version > 0) {
    const repo = await getRecipeRepository();
    await repo.restoreVersion(id, version);
  }
  revalidatePath("/library");
  if (slug) revalidatePath(`/library/${slug}`);
}
