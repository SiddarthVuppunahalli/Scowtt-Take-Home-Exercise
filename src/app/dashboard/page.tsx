import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { getFactForUser } from "@/lib/facts/getFactForUser";
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
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <section className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {session.user.image ? (
                <Image
                  alt=""
                  className="rounded-full"
                  height={56}
                  src={session.user.image}
                  width={56}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700"
                >
                  {(session.user.name ?? session.user.email ?? "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-zinc-950">
                  Movie Memory
                </h1>
                <p className="text-sm text-zinc-600">
                  {session.user.name ?? "Signed-in user"}
                </p>
                <p className="text-sm text-zinc-600">{session.user.email}</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-600">
              Favorite movie
            </p>
            <h2 className="text-3xl font-semibold text-zinc-950">
              {preference.displayTitle}
            </h2>
            <p className="text-sm text-zinc-500">
              Last updated {preference.updatedAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-600">Fun fact</p>
            {movieFactResult.ok ? (
              <>
                <p className="text-sm leading-6 text-zinc-700">
                  {movieFactResult.fact}
                </p>
                <p className="text-xs text-zinc-500">
                  Generated{" "}
                  {movieFactResult.createdAt.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </>
            ) : (
              <p className="text-sm leading-6 text-zinc-600">
                {movieFactResult.message}
              </p>
            )}
          </div>
        </div>
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
    };
  } catch (error) {
    console.error("Failed to generate movie fact", error);

    return {
      ok: false as const,
      message:
        "We could not generate a movie fact right now. Check the OpenAI API key and try again.",
    };
  }
}
