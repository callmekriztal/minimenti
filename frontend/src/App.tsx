import React, { useEffect, useState } from 'react';
import { CreatePoll } from './components/CreatePoll';
import { VotePoll } from './components/VotePoll';
import { PresentPoll } from './components/PresentPoll';
import { CreatePresentation } from './components/CreatePresentation';
import { PresentDeck } from './components/PresentDeck';
import { VoteDeck } from './components/VoteDeck';
import { PollRead, PresentationCreated } from './types';
import { PlusCircle, Sparkles, Layers, Vote, ArrowRight } from 'lucide-react';

type AppView = 'create_deck' | 'create_single' | 'vote_deck' | 'present_deck' | 'vote_single' | 'present_single';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('create_deck');
  const [pollId, setPollId] = useState<string | null>(null);
  const [presentationId, setPresentationId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');

  useEffect(() => {
    const parseUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view');
      const urlPollId = params.get('poll_id');
      const urlPresId = params.get('pres_id');
      const urlCode = params.get('code');
      const urlAdminKey = params.get('admin_key');

      if (urlCode) {
        setView('vote_deck');
        setJoinCode(urlCode);
      } else if (urlView === 'present_deck' && urlPresId) {
        setView('present_deck');
        setPresentationId(urlPresId);
        setAdminKey(urlAdminKey);
      } else if (urlView === 'vote_deck' && urlPresId) {
        setView('vote_deck');
        setPresentationId(urlPresId);
      } else if (urlView === 'vote' && urlPollId) {
        setView('vote_single');
        setPollId(urlPollId);
      } else if (urlView === 'present' && urlPollId) {
        setView('present_single');
        setPollId(urlPollId);
        setAdminKey(urlAdminKey);
      } else if (urlView === 'single') {
        setView('create_single');
      } else {
        setView('create_deck');
      }
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  const handlePresentationCreated = (pres: PresentationCreated) => {
    window.history.pushState({}, '', `/?view=present_deck&pres_id=${pres.id}&admin_key=${pres.admin_key}`);
    setPresentationId(pres.id);
    setAdminKey(pres.admin_key);
    setView('present_deck');
  };

  const handleSinglePollCreated = (poll: PollRead) => {
    window.history.pushState({}, '', `/?view=present&poll_id=${poll.id}&admin_key=${poll.admin_key}`);
    setPollId(poll.id);
    setAdminKey(poll.admin_key || null);
    setView('present_single');
  };

  const navigateToCreateDeck = () => {
    window.history.pushState({}, '', '/');
    setView('create_deck');
    setPollId(null);
    setPresentationId(null);
    setJoinCode(null);
  };

  const navigateToCreateSingle = () => {
    window.history.pushState({}, '', '/?view=single');
    setView('create_single');
    setPollId(null);
    setPresentationId(null);
    setJoinCode(null);
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinInput.trim();
    if (!clean) return;
    window.history.pushState({}, '', `/?code=${clean}`);
    setJoinCode(clean);
    setView('vote_deck');
  };

  // Full-bleed views for presentation screens
  if (view === 'present_deck' && presentationId) {
    return <PresentDeck presentationId={presentationId} adminKey={adminKey} />;
  }

  if (view === 'present_single' && pollId) {
    return <PresentPoll pollId={pollId} adminKey={adminKey} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={navigateToCreateDeck}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition">
              M
            </div>
            <div>
              <span className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                Mini Mentimeter
                <span className="px-1.5 py-0.2 text-[10px] bg-indigo-500/10 text-indigo-400 font-mono rounded border border-indigo-500/20">LIVE</span>
              </span>
              <span className="text-[11px] text-slate-500 block -mt-0.5">Interactive Multi-Question Presentations</span>
            </div>
          </button>

          {/* Quick Join By Code */}
          <form onSubmit={handleJoinWithCode} className="hidden sm:flex items-center gap-1.5">
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="6-digit Room Code"
                className="bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none w-36 font-mono text-center uppercase tracking-wider"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
            >
              Join
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            {view === 'create_single' ? (
              <button
                type="button"
                onClick={navigateToCreateDeck}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Layers className="w-3.5 h-3.5" />
                Multi-Question Deck
              </button>
            ) : view === 'create_deck' ? (
              <button
                type="button"
                onClick={navigateToCreateSingle}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Vote className="w-3.5 h-3.5" />
                Single Poll
              </button>
            ) : (
              <button
                type="button"
                onClick={navigateToCreateDeck}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Presentation
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {view === 'vote_deck' ? (
          <VoteDeck joinCode={joinCode || undefined} presentationId={presentationId || undefined} />
        ) : view === 'vote_single' && pollId ? (
          <VotePoll pollId={pollId} />
        ) : view === 'create_single' ? (
          <CreatePoll onPollCreated={handleSinglePollCreated} />
        ) : (
          <CreatePresentation onPresentationCreated={handlePresentationCreated} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between px-6 gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>FastAPI + PostgreSQL + React + SSE Presentation Engine</span>
          </div>
          <div className="text-slate-600 font-mono">
            Antigravity Educational Project
          </div>
        </div>
      </footer>
    </div>
  );
};
