import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mala Direta TCE-AL",
  description: "Sistema institucional de mala direta com Zimbra, auditoria e fila de envio."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
