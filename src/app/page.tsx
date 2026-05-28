import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInWithGoogleButton } from "@/components/auth-buttons";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    const preference = await prisma.moviePreference.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    redirect(preference ? "/dashboard" : "/onboarding");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-6 py-10 text-zinc-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              Variant A backend correctness
            </div>
            <div className="space-y-5">
              <h1 className="max-w-2xl text-5xl font-semibold leading-tight text-zinc-950 sm:text-6xl">
                Movie Memory
              </h1>
              <p className="max-w-xl text-lg leading-8 text-zinc-700">
                Sign in with Google, save your favorite movie and let the backend
                remember when a fresh fact should be generated or reused.
              </p>
            </div>
            <SignInWithGoogleButton />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">
                    Cached fact preview
                  </p>
                  <p className="text-sm text-zinc-500">Generated responsibly</p>
                </div>
                <div className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  60s TTL
                </div>
              </div>
              <div className="bg-zinc-950 p-5 text-white">
                <p className="text-sm text-zinc-300">Favorite movie</p>
                <p className="mt-2 text-3xl font-semibold">Blade Runner 2049</p>
              </div>
              <div className="space-y-4">
                <div className="border-l-2 border-amber-500 pl-4">
                  <p className="text-sm leading-6 text-zinc-700">
                    Facts are stored in Postgres, scoped to the authenticated
                    user, and protected from burst refreshes.
                  </p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-zinc-200 border-t border-zinc-200 pt-4 text-center">
                  <div>
                    <p className="text-lg font-semibold text-zinc-950">Auth</p>
                    <p className="text-xs text-zinc-500">Google</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-zinc-950">DB</p>
                    <p className="text-xs text-zinc-500">Postgres</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-zinc-950">LLM</p>
                    <p className="text-xs text-zinc-500">OpenAI</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
