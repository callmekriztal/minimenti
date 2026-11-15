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

  // Decision 1: Persistent client browser token
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

        // Check if voter already cast a vote for this poll
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

      if (res.status === 409) {
        localStorage.setItem(`voted_${pollId}`, 'true');
        setHasVoted(true);
        throw new Error('You have already voted in this poll.');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to submit vote');
      }

      // Success! Fire celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
      });

      localStorage.setItem(`voted_${pollId}`, 'true');
      setHasVoted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting vote');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Joining poll...</p>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl">
        <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Poll Not Found</h2>
        <p className="text-slate-400 text-xs mb-6">{error}</p>
        <a href="/" className="inline-block px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition">
          Return Home
        </a>
      </div>
    );
  }

  if (!poll) return null;

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold rounded-full uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Live Poll
          </span>
          {poll.is_closed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-lg">
              <Lock className="w-3 h-3" /> Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
          {poll.question}
        </h1>
      </div>

      {hasVoted ? (
        <div className="p-6 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center space-y-3 animate-in fade-in zoom-in duration-200">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Vote Recorded!</h3>
            <p className="text-xs text-emerald-300/80 mt-1">Thank you for participating. Watch the presentation screen to see the live results unfold.</p>
          </div>
        </div>
      ) : poll.is_closed ? (
        <div className="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl text-center">
          <Lock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-200">Voting is Closed</h3>
          <p className="text-xs text-slate-400 mt-1">The presenter has concluded voting for this question.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select an option:</p>
          {poll.options.map((opt) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={submitting}
                onClick={() => handleVote(opt.id)}
                className={`w-full p-4 rounded-2xl border text-left font-semibold text-sm transition-all duration-150 flex items-center justify-between group ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-[1.01]'
                    : 'bg-slate-950/60 border-slate-800 hover:border-indigo-500/60 hover:bg-slate-800/60 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300'
                  }`}>
                    {String.fromCharCode(65 + opt.position)}
                  </span>
                  <span className="text-base">{opt.text}</span>
                </div>
                {submitting && isSelected && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
