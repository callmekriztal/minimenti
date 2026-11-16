import React, { useEffect, useState } from 'react';
import { CreatePoll } from './components/CreatePoll';
import { VotePoll } from './components/VotePoll';
import { PresentPoll } from './components/PresentPoll';
import { CreatePresentation } from './components/CreatePresentation';
import { PresentDeck } from './components/PresentDeck';
import { VoteDeck } from './components/VoteDeck';
import { PollRead, PresentationCreated } from './types';
import { PlusCircle, Layers, Vote } from 'lucide-react';
import { LoadingScreen } from './components/LoadingScreen';

type AppView = 'create_deck' | 'create_single' | 'vote_deck' | 'present_deck' | 'vote_single' | 'present_single';

const parseUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  const urlView = params.get('view');
  const urlPollId = params.get('poll_id');
  const urlPresId = params.get('pres_id');
  const urlCode = params.get('code');
  const urlAdminKey = params.get('admin_key');

  if (urlCode) {
    return { view: 'vote_deck' as AppView, joinCode: urlCode, pollId: null, presentationId: null, adminKey: null };
  } else if (urlView === 'present_deck' && urlPresId) {
    return { view: 'present_deck' as AppView, joinCode: null, pollId: null, presentationId: urlPresId, adminKey: urlAdminKey };
  } else if (urlView === 'vote_deck' && urlPresId) {
    return { view: 'vote_deck' as AppView, joinCode: null, pollId: null, presentationId: urlPresId, adminKey: null };
  } else if (urlView === 'vote' && urlPollId) {
    return { view: 'vote_single' as AppView, joinCode: null, pollId: urlPollId, presentationId: null, adminKey: null };
  } else if (urlView === 'present' && urlPollId) {
    return { view: 'present_single' as AppView, joinCode: null, pollId: urlPollId, presentationId: null, adminKey: urlAdminKey };
  } else if (urlView === 'single') {
    return { view: 'create_single' as AppView, joinCode: null, pollId: null, presentationId: null, adminKey: null };
  } else {
    return { view: 'create_deck' as AppView, joinCode: null, pollId: null, presentationId: null, adminKey: null };
  }
};

export const App: React.FC = () => {
  const [initial] = useState(parseUrlParams);
  const [view, setView] = useState<AppView>(initial.view);
  const [pollId, setPollId] = useState<string | null>(initial.pollId);
  const [presentationId, setPresentationId] = useState<string | null>(initial.presentationId);
  const [joinCode, setJoinCode] = useState<string | null>(initial.joinCode);
  const [adminKey, setAdminKey] = useState<string | null>(initial.adminKey);
  const [joinInput, setJoinInput] = useState('');
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const minTimer = new Promise((resolve) => setTimeout(resolve, 3000));
    const healthCheck = fetch('/health')
      .then((res) => res.json())
      .catch(() => null);

    Promise.all([minTimer, healthCheck]).then(() => {
      if (mounted) {
        setAppLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlParams();
      setView(parsed.view);
      setPollId(parsed.pollId);
      setPresentationId(parsed.presentationId);
      setJoinCode(parsed.joinCode);
      setAdminKey(parsed.adminKey);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  if (appLoading) {
    return (
      <LoadingScreen
        message="Launching MiniMenti..."
        subtext="Connecting to live presentation engine"
        fullScreen={true}
      />
    );
  }

  if (view === 'present_deck' && presentationId) {
    return <PresentDeck presentationId={presentationId} adminKey={adminKey} />;
  }

  if (view === 'present_single' && pollId) {
    return <PresentPoll pollId={pollId} adminKey={adminKey} />;
  }

  return (
    <div className="min-h-[100dvh] bg-palette-charcoal text-palette-blush flex flex-col justify-between selection:bg-palette-grape selection:text-palette-blush">
      {/* Top Navbar */}
      <header className="border-b border-palette-blueslate/30 bg-palette-charcoal/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={navigateToCreateDeck}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-palette-grape text-palette-blush font-black text-sm flex items-center justify-center shadow-md group-hover:scale-105 transition">
              M
            </div>
            <span className="text-sm font-black text-palette-blush tracking-tight">
              Mini Mentimeter
            </span>
          </button>

          {/* Quick Join Code for Mobile & Desktop */}
          <form onSubmit={handleJoinWithCode} className="flex items-center gap-1.5">
            <input
              type="text"
              maxLength={6}
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Code"
              className="bg-palette-charcoal border border-palette-blueslate/40 focus:border-palette-blush rounded-xl px-2.5 py-1.5 text-xs text-palette-blush placeholder-palette-slate/50 focus:outline-none w-20 sm:w-28 font-mono text-center uppercase tracking-wider"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush rounded-xl text-xs font-bold transition flex items-center gap-1"
            >
              Join
            </button>
          </form>

          {/* New / Switch Mode */}
          <div className="flex items-center gap-2">
            {view === 'create_single' ? (
              <button
                type="button"
                onClick={navigateToCreateDeck}
                className="px-3 py-1.5 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Deck Mode</span>
              </button>
            ) : view === 'create_deck' ? (
              <button
                type="button"
                onClick={navigateToCreateSingle}
                className="px-3 py-1.5 bg-palette-blueslate/20 hover:bg-palette-blueslate/40 border border-palette-blueslate/40 text-palette-slate hover:text-palette-blush text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Vote className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Single Poll</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={navigateToCreateDeck}
                className="px-3 py-1.5 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Deck</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-8">
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

      {/* Minimal Footer */}
      <footer className="border-t border-palette-blueslate/20 py-4 text-center text-xs text-palette-slate">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6">
          <div className="font-semibold text-palette-blush text-xs">
            Mini Mentimeter
          </div>
          <div className="text-palette-slate/60 font-mono text-[11px]">
            © {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
};
