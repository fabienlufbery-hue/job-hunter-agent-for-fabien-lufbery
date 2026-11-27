import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Hunter Agent for Fabien Lufbery',
  description:
    'Assistant autonome de recherche d’emploi, scoring IA Gemini, personnalisation de candidatures, API France Travail v2, Extension Chrome MV3 et intégration Gmail OAuth2 — Job Hunter Agent for Fabien Lufbery.',
  applicationName: 'Job Hunter Agent for Fabien Lufbery',
  authors: [{ name: 'Fabien Lufbery' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="app-ambient-bg font-sans text-slate-100 antialiased selection:bg-indigo-500/35 selection:text-white">
        {children}
      </body>
    </html>
  );
}
