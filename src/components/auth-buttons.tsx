import { signIn, signOut } from "@/auth";

export function SignInWithGoogleButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        type="submit"
      >
        Sign in with Google
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
        type="submit"
      >
        Log out
      </button>
    </form>
  );
}
