import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:
    'Facture.dev - Facturation electronique pour micro-entrepreneurs',
  description:
    'La facturation electronique sans prise de tete. Creez des factures conformes en 3 clics. Obligation 2026/2027.',
  keywords: [
    'facturation electronique',
    'micro-entrepreneur',
    'auto-entrepreneur',
    'facture electronique obligatoire',
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
      <body>{children}</body>
    </html>
  );
}
