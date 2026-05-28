import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import {
  getFactForUser,
  MovieFactUnavailableError,
} from "@/lib/facts/getFactForUser";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const preference = await prisma.moviePreference.findUnique({
    where: { userId: session.user.id },
    select: {
      displayTitle: true,
      movieKey: true,
      updatedAt: true,
    },
  });

  if (!preference) {
    redirect("/onboarding");
  }

  const movieFactResult = await getMovieFact({
    userId: session.user.id,
    movieTitle: preference.displayTitle,
    movieKey: preference.movieKey,
  });

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-6 py-8 text-zinc-950">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {session.user.image ? (
              <Image
                alt=""
                className="rounded-full ring-1 ring-zinc-200"
                height={56}
                src={session.user.image}
                width={56}
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700"
              >
                {(session.user.name ?? session.user.email ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-zinc-500">
                Signed in with Google
              </p>
              <h1 className="truncate text-2xl font-semibold text-zinc-950">
                {session.user.name ?? "Movie Memory"}
              </h1>
              <p className="truncate text-sm text-zinc-600">
                {session.user.email}
              </p>
            </div>
          </div>
          <SignOutButton />
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-500">
                  Favorite movie
                </p>
                <h2 className="text-4xl font-semibold leading-tight text-zinc-950">
                  {preference.displayTitle}
                </h2>
              </div>
              <div className="border-t border-zinc-200 pt-4">
                <p className="text-sm text-zinc-600">
                  Last updated{" "}
                  <span className="font-medium text-zinc-950">
                    {preference.updatedAt.toLocaleDateString()}
                  </span>
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Cache key: {preference.movieKey}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-500">Fun fact</p>
                  <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
                    Backend-generated trivia
                  </h2>
                </div>
                {movieFactResult.ok ? (
                  <span className="w-fit rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                    {movieFactResult.source}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="p-6">
              {movieFactResult.ok ? (
                <div className="space-y-5">
                  <p className="text-lg leading-8 text-zinc-800">
                    {movieFactResult.fact}
                  </p>
                  <p className="border-t border-zinc-200 pt-4 text-sm text-zinc-500">
                    {getFactSourceLabel(movieFactResult.source)}{" "}
                    {movieFactResult.createdAt.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-6 text-zinc-600">
                  {movieFactResult.message}
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 text-sm text-zinc-600 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-zinc-950">Cache window</p>
              <p className="mt-1">Fresh facts are reused for 60 seconds.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-950">Generation lock</p>
              <p className="mt-1">Concurrent refreshes share one OpenAI call.</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-950">Fallback</p>
              <p className="mt-1">Saved facts are shown if generation fails.</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

async function getMovieFact(input: {
  userId: string;
  movieTitle: string;
  movieKey: string;
}) {
  try {
    const movieFact = await getFactForUser(input);

    return {
      ok: true as const,
      fact: movieFact.fact,
      createdAt: movieFact.createdAt,
      source: movieFact.source,
    };
  } catch (error) {
    if (error instanceof MovieFactUnavailableError) {
      return {
        ok: false as const,
        message: error.message,
      };
    }

    console.error("Failed to generate movie fact", error);

    return {
      ok: false as const,
      message: "We could not load a movie fact right now. Try again soon.",
    };
  }
}

function getFactSourceLabel(source: "cache" | "fallback" | "generated") {
  if (source === "cache") {
    return "Loaded from cache";
  }

  if (source === "fallback") {
    return "Showing last saved fact from";
  }

  return "Generated";
}
