"use client";

import { useRef, useState } from "react";
import type { ImportResult } from "@/lib/types";

type Props = {
  initial: ImportResult | null;
  initialImportedAt: string | null;
  dbEnabled: boolean;
};

export function ImportPanel({ initial, initialImportedAt, dbEnabled }: Props) {
  const [data, setData] = useState<ImportResult | null>(initial);
  const [savedAt, setSavedAt] = useState<string | null>(initialImportedAt);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/import", { method: "POST", body: file });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json.result as ImportResult);
      setSavedAt(json.persisted ? new Date().toISOString() : null);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha no upload");
      setStatus("error");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void upload(f);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? "border-brand-2 bg-brand-2/5" : "border-border"
        }`}
      >
        <p className="text-sm text-muted">
          Arraste o <code>.zip</code> do export do LinkedIn aqui, ou
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-lg bg-brand-1 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-2"
        >
          escolher arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <p className="mt-3 text-xs text-muted">
          Baixe em{" "}
          <a
            className="text-linkedin hover:underline"
            href="https://www.linkedin.com/mypreferences/d/download-my-data"
            target="_blank"
            rel="noopener noreferrer"
          >
            linkedin.com/mypreferences/d/download-my-data
          </a>
          . O arquivo é processado em memória.
          {dbEnabled ? "" : " Persistência desligada (sem DATABASE_URL)."}
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-muted">Processando…</p>
      ) : null}
      {status === "error" ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {data ? (
        <Results data={data} savedAt={savedAt} />
      ) : (
        <p className="text-sm text-muted">Nenhum import ainda.</p>
      )}
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Results({
  data,
  savedAt,
}: {
  data: ImportResult;
  savedAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {savedAt
            ? `Salvo ${new Date(savedAt).toLocaleString("pt-BR")}`
            : "Não salvo"}
        </span>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(JSON.stringify(data, null, 2))
          }
          className="rounded border border-border px-2 py-1 hover:bg-border/40"
        >
          Copiar JSON
        </button>
      </div>

      <Card title="Perfil">
        {data.profile ? (
          <>
            <p className="font-medium">
              {`${data.profile.firstName} ${data.profile.lastName}`.trim() || "—"}
            </p>
            {data.profile.headline ? <p>{data.profile.headline}</p> : null}
            <p className="text-sm text-muted">
              {[data.profile.industry, data.profile.geoLocation]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {data.profile.summary ? (
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {data.profile.summary}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">Sem Profile.csv no arquivo.</p>
        )}
      </Card>

      <Card title="Experiência">
        {data.positions.length ? (
          <ul className="flex flex-col gap-3">
            {data.positions.map((p, i) => (
              <li key={i} className="border-l-2 border-border pl-3">
                <p className="font-medium">
                  {[p.title, p.company].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-sm text-muted">
                  {[
                    [p.startedOn, p.finishedOn || (p.startedOn ? "atual" : "")]
                      .filter(Boolean)
                      .join(" – "),
                    p.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {p.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {p.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhuma experiência no arquivo.</p>
        )}
      </Card>

      <Card title="Formação">
        {data.education.length ? (
          <ul className="flex flex-col gap-3">
            {data.education.map((e, i) => (
              <li key={i} className="border-l-2 border-border pl-3">
                <p className="font-medium">{e.school || "—"}</p>
                <p className="text-sm text-muted">
                  {[
                    e.degree,
                    [e.startDate, e.endDate].filter(Boolean).join(" – "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {e.activities ? (
                  <p className="mt-1 text-sm">{e.activities}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhuma formação no arquivo.</p>
        )}
      </Card>

      <Card title="Competências">
        {data.skills.length ? (
          <ul className="flex flex-wrap gap-2">
            {data.skills.map((s, i) => (
              <li key={i} className="rounded-full bg-border/50 px-3 py-1 text-sm">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhuma competência no arquivo.</p>
        )}
      </Card>

      {data.languages.length ? (
        <Card title="Idiomas">
          <ul className="flex flex-col gap-1 text-sm">
            {data.languages.map((l, i) => (
              <li key={i}>
                {l.name}
                {l.proficiency ? ` — ${l.proficiency}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {data.certifications.length ? (
        <Card title="Certificações">
          <ul className="flex flex-col gap-1 text-sm">
            {data.certifications.map((c, i) => (
              <li key={i}>
                {c.name}
                {c.authority ? ` — ${c.authority}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {data.emails.length ? (
        <Card title="E-mails">
          <ul className="flex flex-col gap-1 text-sm">
            {data.emails.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
          Arquivos do .zip e dados não mapeados
        </summary>
        <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
          {data.files.map((f) => (
            <li key={f.name}>
              <code>{f.name}</code> — {f.bytes} bytes
            </li>
          ))}
        </ul>
        {Object.entries(data.unmapped).map(([name, t]) => (
          <div key={name} className="mt-4">
            <p className="text-xs font-semibold">{name}</p>
            <div className="mt-1 overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    {t.headers.map((h, i) => (
                      <th
                        key={i}
                        className="border border-border px-2 py-1 text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      {t.headers.map((_, j) => (
                        <td key={j} className="border border-border px-2 py-1">
                          {r[j] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </details>
    </div>
  );
}
