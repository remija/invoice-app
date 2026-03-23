'use client';

import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Send to API / email list
    setSubmitted(true);
  };

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            La facturation electronique
            <br />
            <span className="text-primary-200">sans prise de tete</span>
          </h1>
          <p className="text-xl sm:text-2xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Creez des factures conformes en 3 clics.
            Reception obligatoire des septembre 2026,
            emission des septembre 2027.
          </p>

          {submitted ? (
            <div className="bg-white/10 backdrop-blur rounded-lg p-6 max-w-md mx-auto">
              <p className="text-lg font-semibold">
                Merci ! Vous serez prevenu(e) au lancement.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <button
                type="submit"
                className="rounded-lg bg-white text-primary-700 font-semibold px-6 py-3 hover:bg-primary-50 transition-colors"
              >
                Me prevenir
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Why */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-16">
            Pourquoi Facture.dev ?
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <Feature
              title="3 clics pour facturer"
              description="Interface pensee pour les micro-entrepreneurs. Zero jargon comptable, zero complexite."
            />
            <Feature
              title="100% conforme"
              description="Factur-X, UBL, CII. Toutes les mentions obligatoires 2026. Connecte a une plateforme agreee."
            />
            <Feature
              title="A partir de 0 EUR"
              description="Recevez vos factures gratuitement. Emettez a partir de 9 EUR/mois. Pas de lock-in bancaire."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-16">Tarifs</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <PricingCard
              name="Decouverte"
              price="0"
              features={[
                '3 factures/mois',
                'Reception de factures',
                'Format Factur-X',
              ]}
            />
            <PricingCard
              name="Solo"
              price="9"
              popular
              features={[
                'Factures illimitees',
                'Tous les formats',
                'E-reporting automatise',
                'Relances email',
                'Lookup SIREN auto',
              ]}
            />
            <PricingCard
              name="Pro"
              price="19"
              features={[
                'Tout Solo +',
                'OCR factures fournisseurs',
                'Factures recurrentes',
                'Tableau de bord',
                'Export comptable',
                'Multi-activite',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Urgency */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-6">Le temps presse</h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <p className="text-2xl font-bold text-orange-600">Sept. 2026</p>
              <p className="text-gray-700 mt-2">
                Reception de factures electroniques obligatoire
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-2xl font-bold text-red-600">Sept. 2027</p>
              <p className="text-gray-700 mt-2">
                Emission de factures electroniques obligatoire
              </p>
            </div>
          </div>
          <p className="text-gray-600">
            Amende de 50 EUR par facture non conforme (plafond 15 000 EUR/an).
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} Facture.dev. Tous droits reserves.</p>
      </footer>
    </main>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  features,
  popular,
}: {
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-8 ${
        popular
          ? 'bg-primary-600 text-white ring-2 ring-primary-600 shadow-xl scale-105'
          : 'bg-white border border-gray-200'
      }`}
    >
      {popular && (
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-200">
          Populaire
        </span>
      )}
      <h3 className="text-xl font-bold mt-2">{name}</h3>
      <p className="mt-4">
        <span className="text-4xl font-bold">{price} EUR</span>
        <span className={popular ? 'text-primary-200' : 'text-gray-500'}>
          {' '}
          HT/mois
        </span>
      </p>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className={popular ? 'text-primary-200' : 'text-primary-600'}>
              &#10003;
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
