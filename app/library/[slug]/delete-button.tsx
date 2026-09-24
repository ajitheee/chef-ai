"use client";

import { deleteRecipe } from "../actions";
import { CHIP } from "@/components/paper";

export function DeleteRecipeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteRecipe}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${name}" from your library? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className={`${CHIP} hover:border-danger hover:text-danger`}>Delete</button>
    </form>
  );
}
