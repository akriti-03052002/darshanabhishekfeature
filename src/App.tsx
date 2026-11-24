/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { ExperienceSpec, getExperienceById, Language, ViewMode } from './data/experiences';
import { ExperienceGrid } from './components/ExperienceGrid';
import { ModeModal } from './components/ModeModal';
import { RitualViewport } from './components/RitualViewport';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [pendingExperience, setPendingExperience] = useState<ExperienceSpec | null>(null);
  const [activeSession, setActiveSession] = useState<{
    experience: ExperienceSpec;
    mode: ViewMode;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart');
    const expParam = params.get('exp');
    const langParam = params.get('lang');
    if (langParam === 'hi' || langParam === 'en') {
      setLang(langParam);
    }
    if (autostart === '1' || autostart === 'vr') {
      const exp = getExperienceById(expParam ?? 'shiva');
      setActiveSession({
        experience: exp,
        mode: autostart === 'vr' ? 'vr' : 'normal'
      });
    } else {
      document.body.dataset.state = 'selection';
    }
  }, []);

  const toggleLang = () => setLang((prev) => (prev === 'en' ? 'hi' : 'en'));

  if (activeSession) {
    return (
      <RitualViewport
        experience={activeSession.experience}
        mode={activeSession.mode}
        lang={lang}
        onToggleLang={toggleLang}
        onExit={() => setActiveSession(null)}
      />
    );
  }

  return (
    <>
      <ExperienceGrid
        lang={lang}
        onToggleLang={toggleLang}
        onSelectExperience={(exp) => setPendingExperience(exp)}
      />

      {pendingExperience && (
        <ModeModal
          experience={pendingExperience}
          lang={lang}
          onClose={() => setPendingExperience(null)}
          onChooseMode={(mode) => {
            setActiveSession({ experience: pendingExperience, mode });
            setPendingExperience(null);
          }}
        />
      )}
    </>
  );
}
