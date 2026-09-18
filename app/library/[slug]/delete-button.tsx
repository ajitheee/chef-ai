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
      <button className="rounded-full border-2 border-[#3A2A1E]/25 px-4 py-2.5 text-xs font-bold text-[#3A2A1E]/60 hover:border-[#B0392A] hover:text-[#B0392A]">
        Delete
      </button>
    </form>
  );
}
