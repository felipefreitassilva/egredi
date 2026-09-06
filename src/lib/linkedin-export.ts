import { parseCsvRows, toObjects } from "./csv";
import { readZip } from "./zip";
import type {
  ExportCertification,
  ExportEducation,
  ExportLanguage,
  ExportPosition,
  ExportProfile,
  ImportResult,
} from "./types";

const MAPPED = new Set([
  "profile.csv",
  "positions.csv",
  "education.csv",
  "skills.csv",
  "languages.csv",
  "certifications.csv",
  "email addresses.csv",
]);

export function parseExport(zip: Buffer): ImportResult {
  const files = readZip(zip);

  const text = (base: string) => {
    const key = Object.keys(files).find(
      (k) => k.split("/").pop()!.toLowerCase() === base.toLowerCase(),
    );
    return key ? files[key].toString("utf8") : null;
  };
  const rowsOf = (base: string) => {
    const t = text(base);
    return t ? toObjects(t) : [];
  };
  const val = (o: Record<string, string>, key: string) => o[key] ?? "";

  const p0 = rowsOf("Profile.csv")[0];
  const profile: ExportProfile | null = p0
    ? {
        firstName: val(p0, "First Name"),
        lastName: val(p0, "Last Name"),
        headline: val(p0, "Headline"),
        summary: val(p0, "Summary"),
        industry: val(p0, "Industry"),
        geoLocation: val(p0, "Geo Location"),
      }
    : null;

  const positions: ExportPosition[] = rowsOf("Positions.csv").map((o) => ({
    company: val(o, "Company Name"),
    title: val(o, "Title"),
    description: val(o, "Description"),
    location: val(o, "Location"),
    startedOn: val(o, "Started On"),
    finishedOn: val(o, "Finished On"),
  }));

  const education: ExportEducation[] = rowsOf("Education.csv").map((o) => ({
    school: val(o, "School Name"),
    degree: val(o, "Degree Name"),
    startDate: val(o, "Start Date"),
    endDate: val(o, "End Date"),
    notes: val(o, "Notes"),
    activities: val(o, "Activities"),
  }));

  const skills = rowsOf("Skills.csv")
    .map((o) => val(o, "Name"))
    .filter(Boolean);

  const languages: ExportLanguage[] = rowsOf("Languages.csv").map((o) => ({
    name: val(o, "Name"),
    proficiency: val(o, "Proficiency"),
  }));

  const certifications: ExportCertification[] = rowsOf("Certifications.csv").map(
    (o) => ({
      name: val(o, "Name"),
      authority: val(o, "Authority"),
      startedOn: val(o, "Started On"),
      finishedOn: val(o, "Finished On"),
      licenseNumber: val(o, "License Number"),
      url: val(o, "Url"),
    }),
  );

  const emails = rowsOf("Email Addresses.csv")
    .map((o) => val(o, "Email Address"))
    .filter(Boolean);

  const unmapped: ImportResult["unmapped"] = {};
  for (const key of Object.keys(files)) {
    const base = key.split("/").pop()!;
    if (!base.toLowerCase().endsWith(".csv")) continue;
    if (MAPPED.has(base.toLowerCase())) continue;
    const rows = parseCsvRows(files[key].toString("utf8"));
    if (rows.length) unmapped[base] = { headers: rows[0], rows: rows.slice(1, 201) };
  }

  return {
    profile,
    positions,
    education,
    skills,
    languages,
    certifications,
    emails,
    files: Object.keys(files).map((name) => ({
      name,
      bytes: files[name].length,
    })),
    unmapped,
  };
}
