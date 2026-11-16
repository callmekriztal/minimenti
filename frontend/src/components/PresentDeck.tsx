import React, { useEffect, useState } from 'react';
import { Users, ChevronLeft, ChevronRight, CheckCircle, Copy, Check, QrCode, Maximize2, Minimize2, Award, Trophy, Crown, Medal } from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { PresentationState } from '../types';
import { LoadingScreen } from './LoadingScreen';



interface PresentDeckProps {
  presentationId: string;
  adminKey?: string | null;
}

// Custom 5-color palette mapping for options
const PALETTE_OPTIONS = [
  { fill: 'bg-palette-grape', border: 'border-palette-grape', text: 'text-palette-blush', badge: 'bg-palette-grape/30 border-palette-grape/50 text-palette-blush' },
  { fill: 'bg-palette-blueslate', border: 'border-palette-blueslate', text: 'text-palette-blush', badge: 'bg-palette-blueslate/30 border-palette-blueslate/50 text-palette-blush' },
  { fill: 'bg-[#7a5882]', border: 'border-[#7a5882]', text: 'text-palette-blush', badge: 'bg-[#7a5882]/30 border-[#7a5882]/50 text-palette-blush' },
  { fill: 'bg-[#475b70]', border: 'border-[#475b70]', text: 'text-palette-blush', badge: 'bg-[#475b70]/30 border-[#475b70]/50 text-palette-blush' },
  { fill: 'bg-palette-charcoal', border: 'border-palette-slate', text: 'text-palette-blush', badge: 'bg-palette-charcoal border-palette-slate/40 text-palette-slate' },
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
    QRCode.toDataURL(voterUrl, { width: 320, margin: 2, color: { dark: '#3a4454', light: '#f5dddd' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [voterUrl]);

  useEffect(() => {
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

  useEffect(() => {
    if (state?.is_finished) {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
      });
    }
  }, [state?.is_finished]);


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
      <LoadingScreen
        message="Loading presentation..."
        fullScreen={true}
      />
    );
  }


  if (state.is_finished) {
    const leaderboard = state.leaderboard || [];

    return (
      <div className="min-h-[100dvh] flex flex-col justify-between bg-palette-charcoal text-palette-blush p-6 sm:p-12 select-none animate-in fade-in duration-300">
        {/* Top Header */}
        <header className="w-full max-w-5xl mx-auto flex items-center justify-between border-b border-palette-blueslate/30 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-palette-grape text-palette-blush font-black text-lg flex items-center justify-center shadow-lg">
              M
            </div>
            <div>
              <span className="text-xs font-bold text-palette-slate uppercase tracking-wider block">Competition Ceremony</span>
              <h2 className="text-xl font-black text-palette-blush tracking-tight">{state.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {effectiveAdminKey && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2 bg-palette-blueslate/20 hover:bg-palette-blueslate/30 border border-palette-blueslate/40 text-palette-blush text-xs font-bold rounded-xl transition shadow-sm"
              >
                ← Back to Questions
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 bg-palette-blueslate/20 hover:bg-palette-blueslate/40 border border-palette-blueslate/30 text-palette-slate hover:text-palette-blush rounded-xl transition"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Podium Area */}
        <main className="w-full max-w-5xl mx-auto my-auto py-8">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-palette-grape/30 border border-palette-grape/40 text-palette-blush text-xs font-bold rounded-full uppercase tracking-wider mb-2">
              <Trophy className="w-3.5 h-3.5 text-palette-blush" />
              Final Leaderboard
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-palette-blush tracking-tight">
              Winners & Standings
            </h1>
          </div>

          {/* Top 3 Podium */}
          {leaderboard.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-3xl mx-auto mb-10 pt-6">
              {/* 2nd Place */}
              <div className="order-1 flex flex-col items-center">
                {leaderboard[1] ? (
                  <>
                    <Medal className="w-7 h-7 text-palette-slate mb-1.5" />
                    <div className="text-sm sm:text-lg font-bold text-palette-blush truncate max-w-full mb-1">
                      {leaderboard[1].nickname}
                    </div>
                    <div className="w-full bg-palette-blueslate/40 border border-palette-blueslate/60 rounded-3xl p-4 sm:p-5 flex flex-col items-center justify-center h-44 sm:h-52 shadow-lg">
                      <span className="text-2xl sm:text-4xl font-black text-palette-blush font-mono">2nd</span>
                      <span className="text-sm sm:text-base font-bold font-mono text-palette-blush mt-1">
                        {leaderboard[1].score.toLocaleString()} pts
                      </span>
                      <span className="text-[11px] text-palette-slate mt-0.5">
                        {leaderboard[1].correct_count}/{leaderboard[1].total_questions} correct
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-32 opacity-0" />
                )}
              </div>

              {/* 1st Place */}
              <div className="order-2 flex flex-col items-center">
                {leaderboard[0] && (
                  <>
                    <Crown className="w-9 h-9 text-palette-blush animate-bounce mb-1.5" />
                    <div className="text-base sm:text-2xl font-black text-palette-blush truncate max-w-full mb-1">
                      {leaderboard[0].nickname}
                    </div>
                    <div className="w-full bg-palette-grape border-2 border-palette-blush/60 rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center h-56 sm:h-64 shadow-2xl">
                      <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-palette-blush mb-2" />
                      <span className="text-3xl sm:text-5xl font-black text-palette-blush font-mono">1st</span>
                      <span className="text-base sm:text-xl font-black font-mono text-palette-blush mt-1">
                        {leaderboard[0].score.toLocaleString()} pts
                      </span>
                      <span className="text-xs text-palette-blush/80 font-semibold mt-0.5">
                        {leaderboard[0].correct_count}/{leaderboard[0].total_questions} correct
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* 3rd Place */}
              <div className="order-3 flex flex-col items-center">
                {leaderboard[2] ? (
                  <>
                    <Medal className="w-6 h-6 text-palette-slate mb-1.5" />
                    <div className="text-sm sm:text-lg font-bold text-palette-blush truncate max-w-full mb-1">
                      {leaderboard[2].nickname}
                    </div>
                    <div className="w-full bg-[#7a5882]/40 border border-[#7a5882]/60 rounded-3xl p-4 sm:p-5 flex flex-col items-center justify-center h-36 sm:h-44 shadow-lg">
                      <span className="text-xl sm:text-3xl font-black text-palette-blush font-mono">3rd</span>
                      <span className="text-sm sm:text-base font-bold font-mono text-palette-blush mt-1">
                        {leaderboard[2].score.toLocaleString()} pts
                      </span>
                      <span className="text-[11px] text-palette-slate mt-0.5">
                        {leaderboard[2].correct_count}/{leaderboard[2].total_questions} correct
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-32 opacity-0" />
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-palette-slate">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No votes were recorded for this presentation.</p>
            </div>
          )}

          {/* Participants ranked 4th and below */}
          {leaderboard.length > 3 && (
            <div className="max-w-xl mx-auto space-y-2">
              <span className="text-xs font-bold text-palette-slate uppercase tracking-wider block mb-2 text-left">
                Runners-Up
              </span>
              {leaderboard.slice(3).map((entry) => (
                <div
                  key={entry.rank}
                  className="p-3 bg-palette-charcoal/80 border border-palette-blueslate/30 rounded-2xl flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-palette-blueslate/30 border border-palette-blueslate/40 flex items-center justify-center font-mono font-bold text-xs text-palette-blush">
                      #{entry.rank}
                    </span>
                    <span className="font-bold text-palette-blush">{entry.nickname}</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-xs text-palette-slate font-sans">
                      {entry.correct_count}/{entry.total_questions} correct
                    </span>
                    <span className="font-black text-palette-blush">
                      {entry.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="w-full max-w-5xl mx-auto border-t border-palette-blueslate/30 pt-5 text-center text-xs text-palette-slate font-mono">
          Interactive Quiz • {leaderboard.length} total players participated
        </footer>
      </div>
    );
  }


  const results = state.results;
  const activePoll = state.active_poll;
  const maxVotes = results ? Math.max(...results.results.map((r) => r.vote_count), 1) : 1;

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-palette-charcoal text-palette-blush p-5 sm:p-10 select-none">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 border-b border-palette-blueslate/30 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-palette-grape text-palette-blush font-black text-lg flex items-center justify-center shadow-lg">
            M
          </div>
          <div>
            <div className="text-xs font-bold text-palette-slate uppercase tracking-wider flex items-center gap-2">
              <span className="text-palette-blush truncate max-w-[200px]">{state.title}</span>
              <span className="w-1 h-1 rounded-full bg-palette-blueslate" />
              <span>Slide {state.active_poll_index + 1}/{state.total_polls}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-palette-slate">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-palette-blush animate-pulse' : 'bg-palette-slate'}`} />
              <span>{connected ? 'Live Sync' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          {/* Join Code Display */}
          <div className="px-3.5 py-1.5 bg-palette-blueslate/30 border border-palette-blueslate/40 rounded-xl flex items-center gap-1.5 shadow-sm">
            <span className="text-[10px] font-bold text-palette-slate uppercase">Code:</span>
            <span className="text-base font-black font-mono text-palette-blush tracking-wider">{state.join_code}</span>
          </div>

          {/* Participants / Vote count */}
          <div className="px-3.5 py-1.5 bg-palette-blueslate/20 border border-palette-blueslate/30 rounded-xl flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-palette-slate" />
            <span className="text-xs font-bold text-palette-blush">
              {state.participants_count ?? results?.total_votes ?? 0} {state.participants_count === 1 ? 'player' : 'players'}
            </span>
          </div>

          {/* Slide Navigation for Admin */}
          {effectiveAdminKey && (
            <div className="flex items-center gap-1 bg-palette-blueslate/20 border border-palette-blueslate/30 p-1 rounded-xl">
              <button
                type="button"
                disabled={state.active_poll_index === 0 || stepping}
                onClick={handlePrev}
                className="px-2.5 py-1 hover:bg-palette-grape/40 text-palette-slate hover:text-palette-blush rounded-lg text-xs font-bold transition disabled:opacity-30"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={stepping}
                onClick={handleNext}
                className="px-3 py-1 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                title="Next"
              >
                {state.active_poll_index < state.total_polls - 1 ? (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    End & Show Leaderboard
                    <Trophy className="w-3.5 h-3.5 text-palette-blush" />
                  </>
                )}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-palette-blueslate/20 hover:bg-palette-blueslate/40 border border-palette-blueslate/30 text-palette-slate hover:text-palette-blush rounded-xl transition"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Question & Results */}
      <main className="w-full max-w-4xl mx-auto my-auto py-8">
        <div className="mb-10 text-center">
          <span className="inline-block px-3 py-1 bg-palette-blueslate/30 border border-palette-blueslate/40 text-palette-slate text-xs font-bold rounded-full uppercase tracking-wider mb-3">
            Question {state.active_poll_index + 1}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-palette-blush tracking-tight leading-tight">
            {activePoll?.question || 'Waiting for question...'}
          </h2>
        </div>

        {/* Results Bar Chart */}
        <div className="space-y-3.5 max-w-3xl mx-auto">
          {results?.results.map((opt, idx) => {
            const color = PALETTE_OPTIONS[idx % PALETTE_OPTIONS.length];
            const percent = results.total_votes > 0 ? Math.round((opt.vote_count / results.total_votes) * 100) : 0;
            const barWidth = `${Math.round((opt.vote_count / maxVotes) * 100)}%`;

            return (
              <div
                key={opt.id}
                className="relative bg-palette-charcoal/90 border border-palette-blueslate/30 rounded-2xl overflow-hidden p-4 sm:p-5 shadow-sm transition hover:border-palette-grape"
              >
                {/* Colored fill bar */}
                <div
                  className={`absolute top-0 bottom-0 left-0 ${color.fill} opacity-35 bar-transition`}
                  style={{ width: barWidth }}
                />

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs ${color.badge}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-palette-blush">
                      {opt.text}
                    </span>
                    {opt.is_correct && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-palette-grape text-palette-blush border border-palette-blush/40 text-[11px] font-bold tracking-wide">
                        <CheckCircle className="w-3 h-3 text-palette-blush" /> Correct Answer
                      </span>
                    )}
                  </div>


                  <div className="flex items-baseline gap-3 shrink-0">
                    <span className="text-xs font-mono font-medium text-palette-slate">
                      {opt.vote_count} {opt.vote_count === 1 ? 'vote' : 'votes'}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-palette-blush font-mono w-14 text-right">
                      {percent}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer / Join URL & QR code */}
      <footer className="w-full max-w-5xl mx-auto border-t border-palette-blueslate/30 pt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-palette-slate">
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={copyVoterLink}
            title="Click to copy voting link"
            className="flex items-center gap-2 bg-palette-blueslate/20 hover:bg-palette-blueslate/30 border border-palette-blueslate/40 text-palette-blush px-3 py-1.5 rounded-xl font-mono text-xs transition cursor-pointer shadow-sm active:scale-95"
          >
            <span className="select-all truncate max-w-[260px] sm:max-w-none">{voterUrl}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-sans font-bold text-palette-blush bg-palette-grape px-2 py-0.5 rounded-md">
                <Check className="w-3 h-3" /> Copied
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-sans text-palette-slate">
                <Copy className="w-3 h-3" /> Copy
              </span>
            )}
          </button>

          {qrDataUrl && (
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-palette-blueslate/20 hover:bg-palette-blueslate/30 border border-palette-blueslate/40 text-palette-blush rounded-xl text-xs font-semibold transition"
            >
              <QrCode className="w-3.5 h-3.5 text-palette-slate" />
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>
          )}
        </div>

        <div className="text-palette-slate/80 font-mono text-[11px]">
          Room Code: <strong className="text-palette-blush">{state.join_code}</strong>
        </div>
      </footer>

      {/* QR Modal */}
      {showQr && qrDataUrl && (
        <div
          onClick={() => setShowQr(false)}
          className="fixed inset-0 bg-palette-charcoal/85 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-palette-charcoal border border-palette-slate/40 rounded-3xl p-6 sm:p-8 text-center max-w-xs shadow-2xl animate-in fade-in zoom-in duration-150 cursor-default"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-palette-blush uppercase tracking-wider">Scan to Vote</span>
              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="text-palette-slate hover:text-palette-blush text-xs font-bold px-2 py-1 bg-palette-blueslate/30 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-palette-blush rounded-2xl mx-auto inline-block shadow-inner mb-4">
              <img src={qrDataUrl} alt="Presentation QR Code" className="w-48 h-48" />
            </div>
            <p className="text-palette-blush text-sm font-bold tracking-wide">Code: {state.join_code}</p>
          </div>
        </div>
      )}
    </div>
  );
};
