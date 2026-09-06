import Image from "next/image";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import { getSession } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  if (session) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <Image src="/logo.png" alt="egredi" width={96} height={96} priority />
        <span className="text-2xl font-semibold tracking-tight">egredi</span>

        {params.error ? (
          <p className="w-full rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-center text-sm text-danger">
            {params.error}
          </p>
        ) : null}

        <SignInButton />
      </div>
    </main>
  );
}
