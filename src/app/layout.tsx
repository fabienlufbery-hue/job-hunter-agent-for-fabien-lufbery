import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

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
    <html lang="fr" className={`dark ${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="app-ambient-bg font-sans text-slate-100 antialiased selection:bg-indigo-500/35 selection:text-white">
        {children}
      </body>
    </html>
  );
}
