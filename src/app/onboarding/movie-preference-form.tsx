"use client";

import { useActionState } from "react";
import {
  saveMoviePreference,
  type SaveMoviePreferenceState,
} from "@/app/onboarding/actions";

const initialState: SaveMoviePreferenceState = {};

export function MoviePreferenceForm() {
  const [state, formAction, isPending] = useActionState(
    saveMoviePreference,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label
          className="block text-sm font-medium text-zinc-950"
          htmlFor="movieTitle"
        >
          Favorite movie
        </label>
        <input
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-950"
          id="movieTitle"
          maxLength={120}
          minLength={2}
          name="movieTitle"
          placeholder="Spider-Man: Into the Spider-Verse"
          required
          type="text"
        />
        {state.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <button
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}
