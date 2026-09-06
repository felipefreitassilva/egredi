import { NextResponse } from "next/server";
import { dbEnabled, saveImport } from "@/lib/db";
import { parseExport } from "@/lib/linkedin-export";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const ab = await req.arrayBuffer();
  if (ab.byteLength === 0)
    return NextResponse.json({ error: "arquivo vazio" }, { status: 400 });
  if (ab.byteLength > MAX_BYTES)
    return NextResponse.json(
      { error: "arquivo acima de 4 MB — use o export rápido do LinkedIn" },
      { status: 413 },
    );

  let result;
  try {
    result = parseExport(Buffer.from(ab));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "zip inválido" },
      { status: 400 },
    );
  }

  let persisted = false;
  try {
    await saveImport(session.sub, result);
    persisted = dbEnabled;
  } catch (e) {
    console.error("saveImport", e);
  }

  return NextResponse.json({ result, persisted });
}
