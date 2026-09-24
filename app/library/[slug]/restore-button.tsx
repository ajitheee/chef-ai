"use client";

import { restoreRecipeVersion } from "../actions";
import { CHIP } from "@/components/paper";

export function RestoreVersionButton({ recipeId, version, slug }: { recipeId: string; version: number; slug: string }) {
  return (
    <form
      action={restoreRecipeVersion}
      onSubmit={(e) => {
        if (!window.confirm(`Restore version ${version}?\n\nThe current version is kept as a previous version, and the recipe goes back to Draft.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={recipeId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="slug" value={slug} />
      <button className={CHIP}>Restore</button>
    </form>
  );
}
