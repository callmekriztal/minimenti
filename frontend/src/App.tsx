import React, { useEffect, useState } from 'react';
import { CreatePoll } from './components/CreatePoll';
import { VotePoll } from './components/VotePoll';
import { PresentPoll } from './components/PresentPoll';
import { PollRead } from './types';
import { PlusCircle, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [view, setView] = useState<'create' | 'vote' | 'present'>('create');
  const [pollId, setPollId] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(null);

  useEffect(() => {
    const parseUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view') as 'create' | 'vote' | 'present' | null;
      const urlPollId = params.get('poll_id');
      const urlAdminKey = params.get('admin_key');

      if (urlView === 'vote' && urlPollId) {
        setView('vote');
        setPollId(urlPollId);
      } else if (urlView === 'present' && urlPollId) {
        setView('present');
        setPollId(urlPollId);
        setAdminKey(urlAdminKey);
      } else {
        setView('create');
      }
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  const handlePollCreated = (poll: PollRead) => {
    // Navigate to presenter view
    window.history.pushState({}, '', `/?view=present&poll_id=${poll.id}&admin_key=${poll.admin_key}`);
    setPollId(poll.id);
    setAdminKey(poll.admin_key || null);
    setView('present');
  };

  const navigateToCreate = () => {
    window.history.pushState({}, '', '/');
    setView('create');
    setPollId(null);
    setAdminKey(null);
  };

  if (view === 'present' && pollId) {
    return <PresentPoll pollId={pollId} adminKey={adminKey} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={navigateToCreate}
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
              <span className="text-[11px] text-slate-500 block -mt-0.5">Real-time audience polling</span>
            </div>
          </button>

          {view !== 'create' && (
            <button
              type="button"
              onClick={navigateToCreate}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Poll
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {view === 'vote' && pollId ? (
          <VotePoll pollId={pollId} />
        ) : (
          <CreatePoll onPollCreated={handlePollCreated} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between px-6 gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>FastAPI + PostgreSQL + React + SSE</span>
          </div>
          <div className="text-slate-600 font-mono">
            Antigravity Educational Project
          </div>
        </div>
      </footer>
    </div>
  );
};
