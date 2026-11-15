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

      // Mark voted
      localStorage.setItem(`voted_${pollId}`, 'true');
      setHasVotedCurrent(true);

      // Trigger celebration confetti
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
      <div className="w-full max-w-md mx-auto text-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
        <p className="text-sm font-medium">Entering presentation...</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center">
        <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
          !
        </div>
        <h2 className="text-lg font-bold text-white">Cannot Join Presentation</h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">{error || 'Presentation not found'}</p>
        <a
          href="/"
          className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
        >
          Return to Home
        </a>
      </div>
    );
  }

  if (state.is_finished) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20 text-white">
          <Award className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Presentation Concluded</h2>
        <p className="text-xs text-slate-400">
          The presenter has finished <strong>{state.title}</strong>. Thank you for voting!
        </p>
      </div>
    );
  }

  const activePoll = state.active_poll;

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold rounded-full uppercase tracking-wider">
            <Layers className="w-3 h-3" />
            Slide {state.active_poll_index + 1} of {state.total_polls}
          </span>
          <span className="text-xs font-mono font-bold text-slate-400">
            {state.title}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
          {activePoll?.question || 'Waiting for next question...'}
        </h1>
      </div>

      {hasVotedCurrent ? (
        <div className="p-6 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center space-y-3 animate-in fade-in zoom-in duration-200">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Vote Recorded!</h3>
            <p className="text-xs text-emerald-300/80 mt-1">
              Look at the main screen to see the live results. Stay on this page — the next question will appear automatically when the presenter advances!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select your answer:</p>
          {activePoll?.options.map((opt) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={submitting}
                onClick={() => handleVote(opt.id)}
                className={`w-full p-4 rounded-2xl border text-left font-semibold text-sm transition-all duration-200 flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-900 active:scale-[0.99]'
                }`}
              >
                <span>{opt.text}</span>
                {isSelected && (
                  <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
