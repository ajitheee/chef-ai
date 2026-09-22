"use client";

import { deleteRecipe } from "../actions";

export function DeleteRecipeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteRecipe}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${name}" from your library? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded-md border border-line px-4 py-2.5 text-xs font-bold text-ink-2 hover:border-danger hover:text-danger">
        Delete
      </button>
    </form>
  );
}
