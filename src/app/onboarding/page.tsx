import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { prisma } from "@/lib/prisma";
import { MoviePreferenceForm } from "./movie-preference-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const preference = await prisma.moviePreference.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (preference) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-6 py-10 text-zinc-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center">
        <div className="w-full rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-5">
            <p className="text-sm font-medium text-zinc-500">Movie Memory</p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              Choose your favorite movie
            </h1>
          </div>
          <div className="grid gap-8 p-6 md:grid-cols-[1fr_0.85fr]">
            <div className="space-y-5">
              <p className="text-sm leading-6 text-zinc-600">
                Signed in as{" "}
                <span className="font-medium text-zinc-950">
                  {session.user.email}
                </span>
                . We will trim and validate this on the server before saving.
              </p>
              <MoviePreferenceForm />
            </div>
            <div className="border-t border-zinc-200 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-zinc-950">
                  What happens next
                </p>
                <ol className="space-y-3 text-sm leading-6 text-zinc-600">
                  <li>1. Your title is normalized for cache consistency.</li>
                  <li>2. The display title is preserved for the dashboard.</li>
                  <li>3. Facts are generated and cached per user and movie.</li>
                </ol>
              </div>
              <div className="mt-8">
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
