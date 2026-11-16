import React, { useEffect, useState } from 'react';
import { Users, Lock, Maximize2, Minimize2, Radio, CheckCircle, ShieldAlert, Copy, Check, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { PollResults } from '../types';
import { LoadingScreen } from './LoadingScreen';


interface PresentPollProps {
  pollId: string;
  adminKey?: string | null;
}

// Custom 5-color palette mapping
const PALETTE_OPTIONS = [
  { fill: 'bg-palette-grape', border: 'border-palette-grape', text: 'text-palette-blush', badge: 'bg-palette-grape/30 border-palette-grape/50 text-palette-blush' },
  { fill: 'bg-palette-blueslate', border: 'border-palette-blueslate', text: 'text-palette-blush', badge: 'bg-palette-blueslate/30 border-palette-blueslate/50 text-palette-blush' },
  { fill: 'bg-[#7a5882]', border: 'border-[#7a5882]', text: 'text-palette-blush', badge: 'bg-[#7a5882]/30 border-[#7a5882]/50 text-palette-blush' },
  { fill: 'bg-[#475b70]', border: 'border-[#475b70]', text: 'text-palette-blush', badge: 'bg-[#475b70]/30 border-[#475b70]/50 text-palette-blush' },
  { fill: 'bg-palette-charcoal', border: 'border-palette-slate', text: 'text-palette-blush', badge: 'bg-palette-charcoal border-palette-slate/40 text-palette-slate' },
];

export const PresentPoll: React.FC<PresentPollProps> = ({ pollId, adminKey: propAdminKey }) => {
  const [data, setData] = useState<PollResults | null>(null);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const effectiveAdminKey = propAdminKey || localStorage.getItem(`admin_key_${pollId}`);
  const voterUrl = `${window.location.origin}/?view=vote&poll_id=${pollId}`;

  useEffect(() => {
    QRCode.toDataURL(voterUrl, { width: 320, margin: 2, color: { dark: '#3a4454', light: '#f5dddd' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [voterUrl]);

  const copyVoterLink = () => {
    navigator.clipboard.writeText(voterUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
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

  if (!data) {
    return (
      <LoadingScreen
        message="Loading live results..."
        fullScreen={true}
      />
    );
  }


  const maxVotes = Math.max(...data.results.map((r) => r.vote_count), 1);

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-palette-charcoal text-palette-blush p-4 sm:p-8 md:p-12 select-none">
      {/* Top Bar */}
      <header className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-b border-palette-blueslate/30 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-palette-grape text-palette-blush font-black text-xl flex items-center justify-center shadow-lg shadow-palette-charcoal/50">
            M
          </div>
          <div>
            <div className="text-xs font-black text-palette-blush uppercase tracking-widest flex items-center gap-2">
              <span>Interactive Poll</span>
              <span className="w-1 h-1 rounded-full bg-palette-slate" />
              <span className="text-palette-slate font-mono text-[11px]">Real-Time SSE</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-palette-slate mt-0.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-palette-blush animate-pulse' : 'bg-palette-slate'}`} />
              <span className="font-medium">{connected ? 'Live Connected' : 'Reconnecting...'}</span>
            </div>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-3">
          {/* Total Votes Counter */}
          <div className="px-4 py-2 glass-panel rounded-2xl flex items-center gap-2.5 shadow-lg border border-palette-blueslate/30">
            <Users className="w-4 h-4 text-palette-blush" />
            <span className="text-xs font-semibold text-palette-slate">
              <strong className="text-palette-blush text-base font-black mr-1">{data.total_votes}</strong>
              {data.total_votes === 1 ? 'vote' : 'votes'}
            </span>
          </div>

          {/* Voting Status */}
          {data.is_closed ? (
            <div className="px-3.5 py-2 bg-palette-charcoal/80 border border-palette-slate/40 text-palette-slate rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Voting Closed
            </div>
          ) : (
            <div className="px-3.5 py-2 bg-palette-grape/25 border border-palette-grape/40 text-palette-blush rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse text-palette-blush" />
              Voting Live
            </div>
          )}

          {/* Admin Close Button */}
          {effectiveAdminKey && !data.is_closed && (
            <button
              type="button"
              disabled={closing}
              onClick={handleCloseVoting}
              className="px-4 py-2 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
            >
              {closing ? (
                <div className="w-3.5 h-3.5 border-2 border-palette-blush/30 border-t-palette-blush rounded-full animate-spin" />
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
            className="p-2.5 bg-palette-charcoal/80 hover:bg-palette-blueslate/30 border border-palette-blueslate/40 text-palette-blush rounded-2xl transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Bar Chart Presentation */}
      <main className="w-full max-w-6xl mx-auto my-auto py-10">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-palette-blush mb-10 tracking-tight leading-tight text-balance">
          {data.question}
        </h1>

        <div className="space-y-4">
          {data.results.map((opt, idx) => {
            const color = PALETTE_OPTIONS[idx % PALETTE_OPTIONS.length];
            const percent = data.total_votes > 0 ? Math.round((opt.vote_count / data.total_votes) * 100) : 0;
            const isLeader = data.total_votes > 0 && opt.vote_count === maxVotes && opt.vote_count > 0;

            return (
              <div
                key={opt.id}
                className="relative overflow-hidden glass-panel border border-palette-blueslate/30 rounded-2xl p-4 sm:p-5 transition hover:border-palette-blueslate/60"
              >
                {/* Background Progress Fill with CSS Transition */}
                <div
                  className={`absolute inset-y-0 left-0 ${color.fill} opacity-25 bar-transition`}
                  style={{ width: `${percent}%` }}
                />

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border shrink-0 ${color.badge}`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-lg sm:text-2xl font-bold text-palette-blush truncate">
                      {opt.text}
                    </span>
                    {isLeader && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-palette-grape/30 border border-palette-blush/30 text-palette-blush text-[11px] font-bold tracking-wide">
                        <CheckCircle className="w-3 h-3 text-palette-blush" /> Leading
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-4 shrink-0">
                    <span className="text-xs sm:text-sm text-palette-slate font-semibold font-mono">
                      {opt.vote_count} {opt.vote_count === 1 ? 'vote' : 'votes'}
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-palette-blush font-mono w-16 text-right">
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
      <footer className="w-full max-w-6xl mx-auto border-t border-palette-blueslate/30 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-palette-slate">
        <div className="flex items-center flex-wrap gap-2.5">
          <span className="px-2.5 py-1 bg-palette-grape/30 text-palette-blush font-bold rounded-lg uppercase tracking-wider text-[10px]">
            Join & Vote
          </span>
          <button
            type="button"
            onClick={copyVoterLink}
            title="Click to copy voting link"
            className="flex items-center gap-2 bg-palette-charcoal/90 hover:bg-palette-charcoal border border-palette-blueslate/40 hover:border-palette-blush/50 text-palette-blush px-3 py-1.5 rounded-xl font-mono text-xs transition group cursor-pointer shadow-sm active:scale-95"
          >
            <span className="text-palette-blush select-all">{voterUrl}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-sans font-bold text-palette-blush bg-palette-grape/40 px-2 py-0.5 rounded-md border border-palette-grape/50">
                <Check className="w-3 h-3" /> Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-sans text-palette-slate group-hover:text-palette-blush">
                <Copy className="w-3 h-3" /> Click to Copy
              </span>
            )}
          </button>

          {qrDataUrl && (
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-palette-blueslate/20 hover:bg-palette-blueslate/30 border border-palette-blueslate/40 text-palette-blush rounded-xl text-xs font-semibold transition"
            >
              <QrCode className="w-3.5 h-3.5 text-palette-blush" />
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>
          )}
        </div>

        <div className="text-palette-slate font-mono text-[11px]">
          Live Interactive Polling
        </div>
      </footer>

      {/* QR Code Modal / Popup for Projector */}
      {showQr && qrDataUrl && (
        <div 
          onClick={() => setShowQr(false)}
          className="fixed inset-0 bg-palette-charcoal/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="glass-panel border border-palette-blueslate/40 rounded-3xl p-6 sm:p-8 text-center max-w-sm shadow-2xl animate-in fade-in zoom-in duration-150 cursor-default bg-palette-charcoal"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-palette-blush uppercase tracking-wider">Scan to Vote</span>
              <button 
                type="button" 
                onClick={() => setShowQr(false)}
                className="text-palette-slate hover:text-palette-blush text-xs font-bold px-2.5 py-1 bg-palette-blueslate/20 rounded-lg transition"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4 bg-palette-blush rounded-2xl mx-auto inline-block shadow-inner mb-4">
              <img src={qrDataUrl} alt="Voting QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
            </div>
            <p className="text-palette-blush text-sm font-bold">Point your phone camera to join</p>
            <p className="text-palette-slate text-xs mt-1 font-mono break-all">{voterUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
};
