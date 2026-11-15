import React, { useEffect, useState } from 'react';
import { Users, Lock, Maximize2, Minimize2, Radio, CheckCircle, ShieldAlert } from 'lucide-react';
import { PollResults } from '../types';

interface PresentPollProps {
  pollId: string;
  adminKey?: string | null;
}

const OPTION_COLORS = [
  { fill: 'bg-indigo-600', text: 'text-indigo-400', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { fill: 'bg-cyan-600', text: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { fill: 'bg-emerald-600', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { fill: 'bg-amber-600', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { fill: 'bg-rose-600', text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { fill: 'bg-purple-600', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { fill: 'bg-teal-600', text: 'text-teal-400', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { fill: 'bg-orange-600', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { fill: 'bg-blue-600', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { fill: 'bg-pink-600', text: 'text-pink-400', badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
];

export const PresentPoll: React.FC<PresentPollProps> = ({ pollId, adminKey: propAdminKey }) => {
  const [data, setData] = useState<PollResults | null>(null);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);

  const effectiveAdminKey = propAdminKey || localStorage.getItem(`admin_key_${pollId}`);

  useEffect(() => {
    // Decision 4: Connect to Server-Sent Events stream
    const eventSource = new EventSource(`/polls/${pollId}/stream`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload: PollResults = JSON.parse(event.data);
        setData(payload);
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [pollId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleCloseVoting = async () => {
    if (!effectiveAdminKey) return;
    if (!confirm('Are you sure you want to close voting for this poll?')) return;

    setClosing(true);
    try {
      const res = await fetch(`/polls/${pollId}/close`, {
        method: 'POST',
        headers: {
          'X-Admin-Key': effectiveAdminKey,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || 'Failed to close poll');
      }
    } catch {
      alert('Network error while closing poll');
    } finally {
      setClosing(false);
    }
  };

  const voterUrl = `${window.location.origin}/?view=vote&poll_id=${pollId}`;

  if (!data) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Connecting to Live Stream...</h2>
        <p className="text-slate-400 text-xs mt-1 font-mono">Listening for poll events on /polls/{pollId}/stream</p>
      </div>
    );
  }

  const maxVotes = Math.max(...data.results.map((r) => r.vote_count), 1);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white p-6 sm:p-12 select-none">
      {/* Top Bar */}
      <header className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            M
          </div>
          <div>
            <div className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <span>Interactive Presentation</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="text-slate-400 font-mono text-[11px]">Real-Time SSE</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-medium">{connected ? 'Live Connected' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-3">
          {/* Total Votes Counter */}
          <div className="px-4 py-2 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-2.5 shadow-lg">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300">
              <strong className="text-white text-base font-black mr-1">{data.total_votes}</strong>
              {data.total_votes === 1 ? 'vote' : 'votes'}
            </span>
          </div>

          {/* Voting Status */}
          {data.is_closed ? (
            <div className="px-3.5 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Voting Closed
            </div>
          ) : (
            <div className="px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              Voting Live
            </div>
          )}

          {/* Admin Close Button */}
          {effectiveAdminKey && !data.is_closed && (
            <button
              type="button"
              disabled={closing}
              onClick={handleCloseVoting}
              className="px-4 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-950/50 hover:scale-105 active:scale-95"
            >
              {closing ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Close Voting
                </>
              )}
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-2xl transition hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Bar Chart Presentation */}
      <main className="w-full max-w-6xl mx-auto my-auto py-10">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white mb-12 tracking-tight leading-tight">
          {data.question}
        </h1>

        <div className="space-y-4">
          {data.results.map((opt, idx) => {
            const color = OPTION_COLORS[idx % OPTION_COLORS.length];
            const percent = data.total_votes > 0 ? Math.round((opt.vote_count / data.total_votes) * 100) : 0;
            const isLeader = data.total_votes > 0 && opt.vote_count === maxVotes && opt.vote_count > 0;

            return (
              <div
                key={opt.id}
                className="relative overflow-hidden bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 transition hover:border-slate-700/80 backdrop-blur-md"
              >
                {/* Background Progress Fill with CSS Transition */}
                <div
                  className={`absolute inset-y-0 left-0 ${color.fill} opacity-20 bar-transition`}
                  style={{ width: `${percent}%` }}
                />

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border shrink-0 ${color.badge}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-lg sm:text-2xl font-bold text-white truncate">
                      {opt.text}
                    </span>
                    {isLeader && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[11px] font-bold tracking-wide">
                        <CheckCircle className="w-3 h-3 text-amber-400" /> Leading
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-4 shrink-0">
                    <span className="text-xs sm:text-sm text-slate-400 font-semibold font-mono">
                      {opt.vote_count} {opt.vote_count === 1 ? 'vote' : 'votes'}
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-white font-mono w-16 text-right">
                      {percent}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer / Audience Instruction */}
      <footer className="w-full max-w-6xl mx-auto border-t border-slate-900 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 font-bold rounded-lg uppercase tracking-wider text-[10px]">
            Join & Vote
          </span>
          <span className="text-slate-300 font-medium">
            Open in browser: <code className="text-indigo-400 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">{voterUrl}</code>
          </span>
        </div>
        <div className="text-slate-600 font-mono text-[11px]">
          Powered by FastAPI & PostgreSQL
        </div>
      </footer>
    </div>
  );
};
