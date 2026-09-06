import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "egredi",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-br">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
