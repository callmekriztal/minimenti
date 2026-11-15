import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, AlertCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PollRead } from '../types';

interface VotePollProps {
  pollId: string;
}

export const VotePoll: React.FC<VotePollProps> = ({ pollId }) => {
  const [poll, setPoll] = useState<PollRead | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVoterToken = (): string => {
    let token = localStorage.getItem('minimenti_voter_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('minimenti_voter_token', token);
    }
    return token;
  };

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const res = await fetch(`/polls/${pollId}`);
        if (!res.ok) throw new Error('Poll not found');
        const data: PollRead = await res.json();
        setPoll(data);

        const voted = localStorage.getItem(`voted_${pollId}`) === 'true';
        setHasVoted(voted);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load poll');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [pollId]);

  const handleVote = async (optionId: number) => {
    if (hasVoted || poll?.is_closed || submitting) return;

    setSelectedOption(optionId);
    setSubmitting(true);
    setError(null);

    const voterToken = getVoterToken();

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
          setHasVoted(true);
          return;
        }
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to submit vote');
      }

      localStorage.setItem(`voted_${pollId}`, 'true');
      setHasVoted(true);

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
        <div className="w-10 h-10 border-3 border-palette-grape border-t-palette-blush rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading poll...</p>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="w-full max-w-sm mx-auto glass-panel rounded-3xl p-6 sm:p-8 text-center shadow-xl">
        <div className="w-12 h-12 bg-palette-grape/30 text-palette-blush rounded-2xl flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-palette-blush mb-1">Poll Not Found</h2>
        <p className="text-palette-slate text-xs mb-5">{error}</p>
        <a href="/" className="inline-block px-5 py-2.5 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush text-xs font-bold rounded-xl transition w-full">
          Return Home
        </a>
      </div>
    );
  }

  if (!poll) return null;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-between min-h-[75dvh] sm:min-h-0 sm:glass-panel rounded-3xl p-5 sm:p-7 sm:shadow-2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-palette-grape/30 border border-palette-grape/40 text-palette-blush text-[11px] font-bold rounded-full uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-palette-slate" />
            Live Poll
          </span>
          {poll.is_closed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-palette-charcoal border border-palette-slate/30 text-palette-slate text-xs font-bold rounded-lg">
              <Lock className="w-3 h-3" /> Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-palette-grape/20 border border-palette-grape/40 text-palette-blush text-xs font-bold rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-palette-blush animate-pulse" /> Active
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-palette-blush leading-tight">
          {poll.question}
        </h1>
      </div>

      <div className="my-6">
        {hasVoted ? (
          <div className="p-6 bg-palette-charcoal/80 border border-palette-grape/40 rounded-3xl text-center space-y-3 animate-in fade-in zoom-in duration-200 shadow-inner">
            <div className="w-12 h-12 bg-palette-grape/40 text-palette-blush rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-palette-blush">Vote Recorded!</h3>
              <p className="text-xs text-palette-slate mt-1 leading-relaxed">Thank you for voting. Watch the main screen to see the live results.</p>
            </div>
          </div>
        ) : poll.is_closed ? (
          <div className="p-6 bg-palette-charcoal/60 border border-palette-blueslate/30 rounded-2xl text-center">
            <Lock className="w-8 h-8 text-palette-slate mx-auto mb-2" />
            <h3 className="text-base font-bold text-palette-blush">Voting is Closed</h3>
            <p className="text-xs text-palette-slate mt-1">The presenter has concluded voting for this question.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {poll.options.map((opt, idx) => {
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

      {error && (
        <div className="p-3 bg-palette-grape/40 border border-palette-blush/30 text-palette-blush rounded-xl text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-palette-slate shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
