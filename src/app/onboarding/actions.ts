"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { normalizeMovieTitle } from "@/lib/facts/normalizeMovieTitle";
import { prisma } from "@/lib/prisma";

const MIN_MOVIE_TITLE_LENGTH = 2;
const MAX_MOVIE_TITLE_LENGTH = 120;

export type SaveMoviePreferenceState = {
  error?: string;
};

export async function saveMoviePreference(
  _previousState: SaveMoviePreferenceState,
  formData: FormData,
): Promise<SaveMoviePreferenceState> {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const rawMovieTitle = formData.get("movieTitle");

  if (typeof rawMovieTitle !== "string") {
    return { error: "Enter a movie title." };
  }

  const displayTitle = rawMovieTitle.trim().replace(/\s+/g, " ");

  if (displayTitle.length < MIN_MOVIE_TITLE_LENGTH) {
    return { error: "Movie title must be at least 2 characters." };
  }

  if (displayTitle.length > MAX_MOVIE_TITLE_LENGTH) {
    return { error: "Movie title must be 120 characters or fewer." };
  }

  await prisma.moviePreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      displayTitle,
      movieKey: normalizeMovieTitle(displayTitle),
    },
    update: {
      displayTitle,
      movieKey: normalizeMovieTitle(displayTitle),
    },
  });

  redirect("/dashboard");
}
