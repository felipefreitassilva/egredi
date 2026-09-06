export type Session = {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  iat: number;
};

export type ExportProfile = {
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  industry: string;
  geoLocation: string;
};

export type ExportPosition = {
  company: string;
  title: string;
  description: string;
  location: string;
  startedOn: string;
  finishedOn: string;
};

export type ExportEducation = {
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
  notes: string;
  activities: string;
};

export type ExportCertification = {
  name: string;
  authority: string;
  startedOn: string;
  finishedOn: string;
  licenseNumber: string;
  url: string;
};

export type ExportLanguage = { name: string; proficiency: string };

export type ImportResult = {
  profile: ExportProfile | null;
  positions: ExportPosition[];
  education: ExportEducation[];
  skills: string[];
  languages: ExportLanguage[];
  certifications: ExportCertification[];
  emails: string[];
  files: { name: string; bytes: number }[];
  unmapped: Record<string, { headers: string[]; rows: string[][] }>;
};
