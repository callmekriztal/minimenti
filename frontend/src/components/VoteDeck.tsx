import React, { useEffect, useState } from 'react';
import { CheckCircle2, Layers, Award, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PresentationState } from '../types';

interface VoteDeckProps {
  joinCode?: string;
  presentationId?: string;
}

export const VoteDeck: React.FC<VoteDeckProps> = ({ joinCode, presentationId }) => {
  const [state, setState] = useState<PresentationState | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasVotedCurrent, setHasVotedCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVoterToken = (): string => {
    let token = localStorage.getItem('minimenti_voter_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('minimenti_voter_token', token);
    }
    return token;
  };

  // Initial load by join code or ID
  useEffect(() => {
    const fetchState = async () => {
      try {
        const url = joinCode
          ? `/presentations/code/${joinCode}`
          : `/presentations/${presentationId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Presentation not found');
        const data: PresentationState = await res.json();
        setState(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to join presentation');
      } finally {
        setLoading(false);
      }
    };

    fetchState();
  }, [joinCode, presentationId]);

  // Connect to SSE stream once presentation_id is known
  useEffect(() => {
    if (!state?.presentation_id) return;

    const eventSource = new EventSource(`/presentations/${state.presentation_id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const payload: PresentationState = JSON.parse(event.data);
        setState(payload);
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    return () => eventSource.close();
  }, [state?.presentation_id]);

  // Check if voter already cast a vote for the current slide
  useEffect(() => {
    if (!state?.active_poll?.id) return;
    const pollId = state.active_poll.id;
    const voted = localStorage.getItem(`voted_${pollId}`) === 'true';
    setHasVotedCurrent(voted);
    setSelectedOption(null);
  }, [state?.active_poll?.id, state?.active_poll_index]);

  const handleVote = async (optionId: number) => {
    if (!state?.active_poll || hasVotedCurrent || submitting || state.is_finished) return;

    setSelectedOption(optionId);
    setSubmitting(true);
    setError(null);

    const voterToken = getVoterToken();
    const pollId = state.active_poll.id;

    try {
      const res = await fetch(`/polls/${pollId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_id: optionId,
          voter_token: voterToken,
        }),
      });

      if (!res.ok) {
        if (res.status === 409) {
          localStorage.setItem(`voted_${pollId}`, 'true');
          setHasVotedCurrent(true);
          return;
        }
        const data = await res.json();
        throw new Error(data.detail || 'Failed to submit vote');
      }

      localStorage.setItem(`voted_${pollId}`, 'true');
      setHasVotedCurrent(true);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while voting');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-sm mx-auto text-center py-16 text-palette-slate">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-palette-blush" />
        <p className="text-sm font-medium tracking-wide">Connecting to presentation...</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="w-full max-w-sm mx-auto glass-panel rounded-3xl p-6 sm:p-8 text-center shadow-xl">
        <div className="w-12 h-12 bg-palette-grape/30 text-palette-blush rounded-2xl flex items-center justify-center mx-auto mb-3 text-lg font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-palette-blush">Cannot Join</h2>
        <p className="text-xs text-palette-slate mt-1 mb-5">{error || 'Presentation not found'}</p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-5 py-3 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush rounded-2xl text-xs font-bold transition shadow-md w-full"
        >
          Return Home
        </a>
      </div>
    );
  }

  if (state.is_finished) {
    return (
      <div className="w-full max-w-sm mx-auto glass-panel rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 bg-palette-grape text-palette-blush rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-palette-charcoal">
          <Award className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-palette-blush">All Done!</h2>
        <p className="text-xs text-palette-slate leading-relaxed">
          The presentation <strong>{state.title}</strong> has concluded. Thank you for voting!
        </p>
      </div>
    );
  }

  const activePoll = state.active_poll;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-between min-h-[75dvh] sm:min-h-0 sm:glass-panel rounded-3xl p-5 sm:p-7 sm:shadow-2xl">
      {/* Header Info */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-palette-grape/30 border border-palette-grape/40 text-palette-blush text-[11px] font-bold rounded-full uppercase tracking-wider">
            <Layers className="w-3 h-3 text-palette-slate" />
            Slide {state.active_poll_index + 1} of {state.total_polls}
          </span>
          <span className="text-xs font-mono font-semibold text-palette-slate truncate max-w-[150px]">
            {state.title}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-palette-blush leading-tight">
          {activePoll?.question || 'Waiting for question...'}
        </h1>
      </div>

      {/* Answer Area */}
      <div className="my-6">
        {hasVotedCurrent ? (
          <div className="p-6 bg-palette-charcoal/80 border border-palette-grape/40 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in duration-200 shadow-inner">
            <div className="w-12 h-12 bg-palette-grape/40 text-palette-blush rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-palette-blush">Vote Recorded!</h3>
              <p className="text-xs text-palette-slate mt-1 leading-relaxed">
                Watch the screen for live results. The next slide will appear automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activePoll?.options.map((opt, idx) => {
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleVote(opt.id)}
                  className={`w-full min-h-[56px] px-5 py-3.5 rounded-2xl border text-left font-bold text-sm transition-all duration-150 flex items-center justify-between active:scale-[0.98] ${
                    isSelected
                      ? 'bg-palette-grape border-palette-blush text-palette-blush shadow-lg scale-[1.01]'
                      : 'bg-palette-charcoal/90 border-palette-blueslate/40 text-palette-blush hover:border-palette-grape hover:bg-palette-charcoal'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-palette-blueslate/30 border border-palette-slate/20 text-palette-slate text-xs flex items-center justify-center font-mono font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt.text}</span>
                  </div>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-palette-blush animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer minimal info */}
      <div className="text-center pt-2">
        <span className="text-[11px] font-mono text-palette-slate/70">
          Room Code: <strong className="text-palette-blush tracking-wider">{state.join_code}</strong>
        </span>
      </div>
    </div>
  );
};
