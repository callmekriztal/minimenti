import React, { useEffect, useState } from 'react';
import { Users, ChevronLeft, ChevronRight, CheckCircle, Copy, Check, QrCode, Maximize2, Minimize2, Award } from 'lucide-react';
import QRCode from 'qrcode';
import { PresentationState } from '../types';

interface PresentDeckProps {
  presentationId: string;
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
];

export const PresentDeck: React.FC<PresentDeckProps> = ({ presentationId, adminKey: propAdminKey }) => {
  const [state, setState] = useState<PresentationState | null>(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stepping, setStepping] = useState(false);

  const effectiveAdminKey = propAdminKey || localStorage.getItem(`pres_admin_key_${presentationId}`);
  const voterUrl = state ? `${window.location.origin}/?code=${state.join_code}` : '';

  useEffect(() => {
    if (!voterUrl) return;
    QRCode.toDataURL(voterUrl, { width: 300, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [voterUrl]);

  useEffect(() => {
    // Connect to presentation live stream
    const eventSource = new EventSource(`/presentations/${presentationId}/stream`);

    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);

    eventSource.onmessage = (event) => {
      try {
        const payload: PresentationState = JSON.parse(event.data);
        setState(payload);
      } catch (err) {
        console.error('Error parsing SSE presentation event:', err);
      }
    };

    return () => eventSource.close();
  }, [presentationId]);

  const copyVoterLink = () => {
    if (!voterUrl) return;
    navigator.clipboard.writeText(voterUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = async () => {
    if (!effectiveAdminKey || stepping) return;
    setStepping(true);
    try {
      const res = await fetch(`/presentations/${presentationId}/next`, {
        method: 'POST',
        headers: { 'X-Admin-Key': effectiveAdminKey },
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } finally {
      setStepping(false);
    }
  };

  const handlePrev = async () => {
    if (!effectiveAdminKey || stepping) return;
    setStepping(true);
    try {
      const res = await fetch(`/presentations/${presentationId}/prev`, {
        method: 'POST',
        headers: { 'X-Admin-Key': effectiveAdminKey },
      });
      if (res.ok) {
        const updated = await res.json();
        setState(updated);
      }
    } finally {
      setStepping(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!state) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">Connecting to Presentation...</h2>
        <p className="text-slate-400 text-xs mt-1 font-mono">Syncing slides on /presentations/{presentationId}/stream</p>
      </div>
    );
  }

  if (state.is_finished) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white p-8 sm:p-16 text-center select-none">
        <div className="max-w-xl mx-auto my-auto space-y-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20">
            <Award className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Presentation Finished!</h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Thank you for participating in <strong>{state.title}</strong>. All {state.total_polls} questions have concluded.
          </p>
          {effectiveAdminKey && (
            <button
              type="button"
              onClick={handlePrev}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl transition"
            >
              ← Reopen Last Question
            </button>
          )}
        </div>
      </div>
    );
  }

  const results = state.results;
  const activePoll = state.active_poll;
  const maxVotes = results ? Math.max(...results.results.map((r) => r.vote_count), 1) : 1;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white p-6 sm:p-12 select-none">
      {/* Top Bar with Join Code & Slide Navigation */}
      <header className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            M
          </div>
          <div>
            <div className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <span>{state.title}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="text-slate-400 font-mono text-[11px]">Slide {state.active_poll_index + 1} of {state.total_polls}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-medium">{connected ? 'Live Sync Active' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>

        {/* Join Code Callout & Controls */}
        <div className="flex items-center gap-3">
          {/* Prominent 6-digit Join Code */}
          <div className="px-4 py-2 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center gap-2 shadow-lg">
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Join Code:</span>
            <span className="text-lg font-black font-mono text-white tracking-widest">{state.join_code}</span>
          </div>

          {/* Votes Count */}
          {results && (
            <div className="px-4 py-2 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-2 shadow-lg">
              <Users className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">
                <strong className="text-white text-base font-black mr-1">{results.total_votes}</strong>
                {results.total_votes === 1 ? 'vote' : 'votes'}
              </span>
            </div>
          )}

          {/* Slide Navigation Buttons (for Admin) */}
          {effectiveAdminKey && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-2xl">
              <button
                type="button"
                disabled={state.active_poll_index === 0 || stepping}
                onClick={handlePrev}
                className="px-3 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition disabled:opacity-30 flex items-center gap-1"
                title="Previous Slide"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={stepping}
                onClick={handleNext}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-indigo-600/30"
                title="Next Slide"
              >
                {state.active_poll_index < state.total_polls - 1 ? (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Finish
                    <CheckCircle className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Question Display & Animated Bar Chart */}
      <main className="w-full max-w-5xl mx-auto my-auto py-8">
        <div className="mb-10 text-center">
          <span className="inline-block px-3 py-1 bg-slate-800/80 border border-slate-700/50 text-slate-400 font-mono text-xs rounded-full uppercase tracking-wider mb-3">
            Question {state.active_poll_index + 1} of {state.total_polls}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto">
            {activePoll?.question || 'Waiting for question...'}
          </h2>
        </div>

        {/* Real-Time Animated Results Bars */}
        <div className="space-y-4 max-w-4xl mx-auto">
          {results?.results.map((opt, idx) => {
            const color = OPTION_COLORS[idx % OPTION_COLORS.length];
            const percent = results.total_votes > 0 ? Math.round((opt.vote_count / results.total_votes) * 100) : 0;
            const barWidth = `${Math.round((opt.vote_count / maxVotes) * 100)}%`;

            return (
              <div
                key={opt.id}
                className="relative bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden p-4 sm:p-5 transition hover:border-slate-700"
              >
                {/* Background animated progress bar */}
                <div
                  className={`absolute top-0 bottom-0 left-0 ${color.fill} opacity-20 transition-all duration-700 ease-out`}
                  style={{ width: barWidth }}
                />

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs ${color.badge}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-slate-100">
                      {opt.text}
                    </span>
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

      {/* Footer / Instructions */}
      <footer className="w-full max-w-6xl mx-auto border-t border-slate-900 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center flex-wrap gap-2.5">
          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 font-bold rounded-lg uppercase tracking-wider text-[10px]">
            Join on any device
          </span>
          <button
            type="button"
            onClick={copyVoterLink}
            title="Click to copy voting link"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 text-slate-200 px-3 py-1.5 rounded-xl font-mono text-xs transition group cursor-pointer shadow-sm active:scale-95"
          >
            <span className="text-indigo-400 select-all">{voterUrl}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-sans font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <Check className="w-3 h-3 text-emerald-400" /> Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-sans text-slate-400 group-hover:text-indigo-300">
                <Copy className="w-3 h-3" /> Click to Copy
              </span>
            )}
          </button>

          {qrDataUrl && (
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-400" />
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>
          )}
        </div>

        <div className="text-slate-600 font-mono text-[11px]">
          Room Code: <strong className="text-white">{state.join_code}</strong>
        </div>
      </footer>

      {/* QR Code Modal */}
      {showQr && qrDataUrl && (
        <div
          onClick={() => setShowQr(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center max-w-sm shadow-2xl animate-in fade-in zoom-in duration-150 cursor-default"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Scan to Join Deck</span>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4 bg-white rounded-2xl mx-auto inline-block shadow-inner mb-4">
              <img src={qrDataUrl} alt="Presentation QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
            </div>
            <p className="text-white text-sm font-bold">Join Code: {state.join_code}</p>
            <p className="text-slate-400 text-xs mt-1 font-mono break-all">{voterUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
};
