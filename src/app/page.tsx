import Image from "next/image";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex flex-col items-center gap-4">
        <Image src="/logo.png" alt="egredi" width={96} height={96} priority />
        <span className="text-2xl font-semibold tracking-tight">egredi</span>
        {/* TODO copy + <SignInButton /> (commit 2) */}
      </div>
    </main>
  );
}
