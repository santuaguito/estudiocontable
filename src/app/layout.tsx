import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estudio | Gestión contable",
  description: "Gestión de empresas y equipos para estudios contables.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
