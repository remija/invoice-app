'use client';

import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      // TODO: Send to API / email list
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content">
      {/* Hero */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 text-white"
      >
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32 text-center">
          <h1
            id="hero-heading"
            className="text-4xl sm:text-6xl font-bold tracking-tight mb-6"
          >
            La facturation électronique
            <br />
            <span className="text-primary-200">sans prise de tête</span>
          </h1>
          <p className="text-xl sm:text-2xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Créez des factures conformes en 3 clics.
            Réception obligatoire dès septembre 2026,
            émission dès septembre 2027.
          </p>

          {submitted ? (
            <div
              role="status"
              className="bg-white/10 backdrop-blur rounded-lg p-6 max-w-md mx-auto"
            >
              <p className="text-lg font-semibold">
                Merci ! Vous serez prévenu(e) au lancement.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <label htmlFor="notify-email" className="sr-only">
                Adresse email
              </label>
              <input
                id="notify-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-white text-primary-700 font-semibold px-6 py-3 hover:bg-primary-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Envoi en cours\u2026' : 'Me prévenir'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Why */}
      <section aria-labelledby="why-heading" className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2
            id="why-heading"
            className="text-3xl font-bold text-center mb-16"
          >
            Pourquoi Facture.dev ?
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <Feature
              title="3 clics pour facturer"
              description="Interface pensée pour les micro-entrepreneurs. Zéro jargon comptable, zéro complexité."
            />
            <Feature
              title="100 % conforme"
              description="Factur-X, UBL, CII. Toutes les mentions obligatoires 2026. Connecté à une plateforme agréée."
            />
            <Feature
              title="À partir de 0 €"
              description="Recevez vos factures gratuitement. Émettez à partir de 9 €/mois. Sans engagement bancaire."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        aria-labelledby="pricing-heading"
        className="py-20 px-6 bg-gray-50"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="pricing-heading"
            className="text-3xl font-bold text-center mb-16"
          >
            Tarifs
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <PricingCard
              name="Découverte"
              price="0"
              features={[
                '3 factures/mois',
                'Réception de factures',
                'Format Factur-X',
              ]}
            />
            <PricingCard
              name="Solo"
              price="9"
              popular
              features={[
                'Factures illimitées',
                'Tous les formats',
                'E-reporting automatisé',
                'Relances par email',
                'Recherche SIREN automatique',
              ]}
            />
            <PricingCard
              name="Pro"
              price="19"
              features={[
                'Tout de Solo, plus :',
                'Scan des factures reçues',
                'Factures récurrentes',
                'Tableau de bord',
                'Export comptable',
                'Gestion multi-activités',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Urgency */}
      <section aria-labelledby="urgency-heading" className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="urgency-heading" className="text-3xl font-bold mb-6">
            Le temps presse
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <p className="text-2xl font-bold text-orange-600">Sept. 2026</p>
              <p className="text-gray-700 mt-2">
                Réception de factures électroniques obligatoire
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-2xl font-bold text-red-600">Sept. 2027</p>
              <p className="text-gray-700 mt-2">
                Émission de factures électroniques obligatoire
              </p>
            </div>
          </div>
          <p className="text-gray-600">
            Amende de 50 € par facture non conforme (plafond 15 000 €/an).
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6 text-sm">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; {new Date().getFullYear()} Facture.dev. Tous droits
            réservés.
          </p>
          <nav aria-label="Liens légaux" className="flex gap-6">
            <a href="/mentions-legales" className="hover:text-gray-300 transition-colors">
              Mentions légales
            </a>
            <a href="/cgu" className="hover:text-gray-300 transition-colors">
              CGU
            </a>
            <a href="/confidentialite" className="hover:text-gray-300 transition-colors">
              Confidentialité
            </a>
          </nav>
        </div>
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
        <span className="text-4xl font-bold">{price} €</span>
        <span className={popular ? 'text-primary-200' : 'text-gray-500'}>
          {' '}
          HT/mois
        </span>
      </p>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={popular ? 'text-primary-200' : 'text-primary-600'}
            >
              &#10003;
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
