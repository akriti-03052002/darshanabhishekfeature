import React, { useState } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { EXPERIENCES, ExperienceSpec, Language, TraditionGroup } from '../data/experiences';

interface ExperienceGridProps {
  lang: Language;
  onToggleLang: () => void;
  onSelectExperience: (exp: ExperienceSpec) => void;
}

const FILTER_LABELS: Record<TraditionGroup, Record<Language, string>> = {
  all: { hi: 'सभी परंपराएँ', en: 'All Traditions' },
  sanatan: { hi: 'सनातन धर्म', en: 'Sanatan Dharma' },
  dharmic: { hi: 'बौद्ध · सिख · जैन', en: 'Buddhist · Sikh · Jain' },
  abrahamic: { hi: 'ईसाई · सूफ़ी ज़ियारत', en: 'Christian · Sufi' }
};

export const ExperienceGrid: React.FC<ExperienceGridProps> = ({
  lang,
  onToggleLang,
  onSelectExperience
}) => {
  const [filter, setFilter] = useState<TraditionGroup>('all');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const visible = filter === 'all'
    ? EXPERIENCES
    : EXPERIENCES.filter((e) => e.traditionGroup === filter);

  return (
    <div className="min-h-screen bg-[#0e0c0a] text-[#f5efe6]">
      {/* 3-Zone Top Bar Contract: Brand — Single-Line Tradition Links — 1 Action */}
      <header className="sticky top-0 z-30 border-b border-[#2a231b] bg-[#0e0c0a]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-2xl font-semibold tracking-wide text-amber-200 whitespace-nowrap shrink-0"
          >
            DARSHAN
          </a>

          <nav aria-label="Tradition filter" className="hidden md:flex items-center gap-7 text-sm">
            {(['all', 'sanatan', 'dharmic', 'abrahamic'] as TraditionGroup[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`whitespace-nowrap shrink-0 pb-1 transition-colors cursor-pointer ${
                  filter === key
                    ? 'border-b border-amber-400 text-amber-200 font-medium'
                    : 'text-[#b5aa99] hover:text-[#f5efe6]'
                }`}
              >
                {FILTER_LABELS[key][lang]}
              </button>
            ))}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onToggleLang}
              aria-label={lang === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
              className="inline-flex items-center gap-2 rounded-lg border border-[#3a3025] bg-[#1a1510] px-4 py-2 text-xs font-medium text-amber-100 hover:border-amber-500/60 hover:bg-[#241d16] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>{lang === 'hi' ? 'English' : 'हिंदी'}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-6 pb-20 pt-10">
        {/* Focused Editorial Hero */}
        <section className="mb-10 max-w-3xl">
          <p className="text-xs font-medium tracking-wider text-amber-400/90">
            {lang === 'hi'
              ? 'प्रथम-पुरुष पवित्र पूजा एवं सेवा अनुभव'
              : 'First-Person Sacred Pooja & Seva'}
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold leading-tight text-[#faf5ed] sm:text-5xl text-balance">
            {lang === 'hi'
              ? 'अपने आराध्य के सम्मुख खड़े होकर स्वयं अपने हाथों से सेवा करें'
              : 'Stand Directly Before Your Aaradhya and Offer Seva With Your Own Hands'}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#b8ad9d]">
            {lang === 'hi'
              ? 'अपना आराध्य चुनें और सामान्य स्क्रीन या वीआर हेडसेट में प्रवेश करें — कलश से जल व दुग्ध धारा, पुष्प, आरती और प्रत्येक परंपरा की प्रामाणिक विधि के साथ।'
              : 'Select your sacred experience and enter directly in Normal Screen or VR Headset mode — with articulated virtual hands, continuous pouring, flowers, lamps, and tradition-specific offerings.'}
          </p>

          {/* Mobile Tradition Selector */}
          <div className="mt-6 flex flex-wrap gap-2 md:hidden">
            {(['all', 'sanatan', 'dharmic', 'abrahamic'] as TraditionGroup[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? 'bg-amber-600 text-[#120d08]'
                    : 'bg-[#1a1510] text-[#b5aa99] border border-[#2c241b]'
                }`}
              >
                {FILTER_LABELS[key][lang]}
              </button>
            ))}
          </div>
        </section>

        {/* 9 Populated God-Wise Experiences */}
        <section aria-label="Spiritual Experiences">
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((exp) => {
              const hasFailed = failedImages[exp.id];
              return (
                <article
                  key={exp.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#2a231b] bg-[#16120e] transition-colors hover:border-amber-500/50"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1e1812]">
                    {!hasFailed ? (
                      <img
                        src={exp.imageUrl}
                        alt={exp.title[lang]}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages((prev) => ({ ...prev, [exp.id]: true }))}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#2a1f14] to-[#120e0a] p-6 text-center">
                        <span className="font-display text-2xl text-amber-200">{exp.title[lang]}</span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#16120e] via-transparent to-transparent opacity-80" />
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs text-amber-400/90">
                      <span>{exp.traditionLabel[lang]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums text-[#a89c8c]">
                        {exp.steps.length} {lang === 'hi' ? 'विधि चरण' : 'Offerings'}
                      </span>
                    </div>

                    <h2 className="font-display mt-1.5 text-2xl font-semibold leading-snug text-[#faf5ed]">
                      {exp.title[lang]}
                    </h2>

                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#b2a797] line-clamp-3">
                      {exp.description[lang]}
                    </p>

                    <div className="mt-5 pt-3 border-t border-[#261f18]">
                      <button
                        type="button"
                        onClick={() => onSelectExperience(exp)}
                        aria-label={`${lang === 'hi' ? 'आरंभ करें' : 'Start'} ${exp.title[lang]}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-[#120d08] hover:bg-amber-500 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>{lang === 'hi' ? 'प्रवेश करें' : 'Begin Seva'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};
