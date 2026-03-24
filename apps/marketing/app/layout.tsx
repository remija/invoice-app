import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:
    'Facture.dev - Facturation électronique pour micro-entrepreneurs',
  description:
    'La facturation électronique sans prise de tête. Créez des factures conformes en 3 clics. Obligation 2026/2027.',
  keywords: [
    'facturation électronique',
    'micro-entrepreneur',
    'auto-entrepreneur',
    'facture électronique obligatoire',
    'Factur-X',
    'logiciel facturation',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-700 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
