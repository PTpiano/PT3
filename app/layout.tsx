import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "P. Taglieri — Pianista | Nocturne Underground",
  description:
    "Peppe Taglieri, pianista jazz fusion: musica, album, gallery, concerti e booking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
