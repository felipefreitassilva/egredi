import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ImportPanel } from "@/components/ImportPanel";
import { dbEnabled, getProfile } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/");

  const row = await getProfile(session.sub);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <DashboardHeader session={session} />
      <ImportPanel
        initial={row?.import_json ?? null}
        initialImportedAt={row?.imported_at ?? null}
        dbEnabled={dbEnabled}
      />
    </main>
  );
}
