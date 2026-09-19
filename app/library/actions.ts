"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRecipeRepository, STARTER_RECIPES, CHEF_RECIPES } from "@/lib/data/recipes";

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
