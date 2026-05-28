import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { prisma } from "@/lib/prisma";

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
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-zinc-950">
              Favorite movie
            </h1>
            <p className="text-sm leading-6 text-zinc-600">
              Signed in as {session.user.email}. The movie form comes next.
            </p>
          </div>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
