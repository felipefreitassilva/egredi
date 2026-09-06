import Image from "next/image";
import type { Session } from "@/lib/types";

export function DashboardHeader({ session }: { session: Session }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <Image src="/logo.png" alt="egredi" width={32} height={32} />
        <span className="font-semibold tracking-tight">egredi</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {session.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.picture}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : null}
        <span className="text-muted">
          {session.name} · {session.email}
        </span>
        <a href="/api/auth/logout" className="text-linkedin hover:underline">
          Sair
        </a>
        <form method="post" action="/api/account/delete">
          <button type="submit" className="text-danger hover:underline">
            Apagar meus dados
          </button>
        </form>
      </div>
    </header>
  );
}
