import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebMCP Check — does your site expose tools to AI agents?",
  description:
    "Enter a domain and see whether an AI agent's browser would discover WebMCP tools on it — both the imperative (navigator.modelContext) and declarative (<form toolname>) APIs — validated against the W3C WebMCP specification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-grid antialiased">{children}</body>
    </html>
  );
}
