import React, { useEffect, useState } from 'react';
import { CheckCircle2, Layers, Loader2, Trophy, Crown, ArrowRight, Sparkles, User, Medal } from 'lucide-react';
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

  // Joinee nickname state
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem('minimenti_nickname') || '');
  const [nicknameInput, setNicknameInput] = useState<string>(() => localStorage.getItem('minimenti_nickname') || '');
  const [hasJoined, setHasJoined] = useState<boolean>(() => !!localStorage.getItem('minimenti_nickname'));
  const [joining, setJoining] = useState(false);

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

  // Auto-register participant if nickname already exists in localStorage
  useEffect(() => {
    if (!state?.presentation_id || !nickname || !hasJoined) return;
    const voterToken = getVoterToken();
    fetch(`/presentations/${state.presentation_id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_token: voterToken, nickname }),
    }).catch((err) => console.error('Error auto-joining presentation:', err));
  }, [state?.presentation_id, nickname, hasJoined]);

  // Trigger celebration confetti when presentation concludes
  useEffect(() => {
    if (state?.is_finished) {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [state?.is_finished]);

  // Check if voter already cast a vote for the current slide
  useEffect(() => {
    if (!state?.active_poll?.id) return;
    const pollId = state.active_poll.id;
    const voted = localStorage.getItem(`voted_${pollId}`) === 'true';
    setHasVotedCurrent(voted);
    setSelectedOption(null);
  }, [state?.active_poll?.id, state?.active_poll_index]);

  const handleJoinNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nicknameInput.trim();
    if (!clean || !state?.presentation_id) return;

    setJoining(true);
    const voterToken = getVoterToken();

    try {
      const res = await fetch(`/presentations/${state.presentation_id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter_token: voterToken,
          nickname: clean,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to join');
      }

      const updatedState: PresentationState = await res.json();
      setState(updatedState);
      localStorage.setItem('minimenti_nickname', clean);
      setNickname(clean);
      setHasJoined(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error joining presentation');
    } finally {
      setJoining(false);
    }
  };

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
          nickname: nickname || undefined,
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

  // 1. Participant Nickname Join Step
  if (!hasJoined) {
    return (
      <div className="w-full max-w-sm mx-auto glass-panel rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="w-14 h-14 bg-palette-grape text-palette-blush rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-palette-charcoal">
          <Sparkles className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-palette-slate uppercase tracking-wider block mb-1">
            Join Quiz Competition
          </span>
          <h2 className="text-2xl font-black text-palette-blush tracking-tight">{state.title}</h2>
          <p className="text-xs text-palette-slate mt-1.5 leading-relaxed">
            Enter your nickname to join the game and compete on the live leaderboard!
          </p>
        </div>

        <form onSubmit={handleJoinNickname} className="space-y-4 text-left">
          <div>
            <label htmlFor="participant-nickname" className="block text-xs font-bold text-palette-slate uppercase tracking-wider mb-2">
              Your Name / Nickname
            </label>
            <input
              id="participant-nickname"
              type="text"
              required
              maxLength={30}
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="e.g. Alex or StarGazer"
              className="w-full bg-palette-charcoal/90 border border-palette-blueslate/40 focus:border-palette-blush text-palette-blush placeholder-palette-slate/50 px-4 py-3 rounded-2xl text-sm transition outline-none font-bold"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={joining || !nicknameInput.trim()}
            className="w-full min-h-[50px] px-6 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush font-bold text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {joining ? (
              <div className="w-4 h-4 border-2 border-palette-blush/30 border-t-palette-blush rounded-full animate-spin" />
            ) : (
              <>
                Enter Game
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-[11px] text-palette-slate font-mono">
          Room Code: <strong className="text-palette-blush">{state.join_code}</strong>
        </div>
      </div>
    );
  }

  // 2. Finished Presentation: Real-time Leaderboard Visible to Everyone
  if (state.is_finished) {
    const leaderboard = state.leaderboard || [];
    const voterToken = getVoterToken();
    const currentUserEntry = leaderboard.find((e) => e.voter_token === voterToken || e.nickname === nickname);

    return (
      <div className="w-full max-w-md mx-auto glass-panel rounded-3xl p-5 sm:p-7 text-center space-y-6 shadow-2xl animate-in fade-in duration-300">
        {/* Celebration Header */}
        <div>
          <div className="w-14 h-14 bg-palette-grape text-palette-blush rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-palette-charcoal mb-3">
            <Trophy className="w-7 h-7 text-palette-blush" />
          </div>
          <span className="text-[10px] font-bold text-palette-slate uppercase tracking-wider block">
            Final Results
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-palette-blush tracking-tight">Leaderboard</h2>
          <p className="text-xs text-palette-slate mt-1">{state.title}</p>
        </div>

        {/* Personalized Rank Banner */}
        {currentUserEntry && (
          <div className="p-4 bg-palette-grape/30 border border-palette-blush/30 rounded-2xl flex items-center justify-between text-left shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-palette-grape text-palette-blush font-black text-sm flex items-center justify-center border border-palette-blush/50">
                #{currentUserEntry.rank}
              </span>
              <div>
                <div className="text-xs font-bold text-palette-blush flex items-center gap-1.5">
                  <span>{currentUserEntry.nickname} (You)</span>
                </div>
                <div className="text-[11px] text-palette-slate">
                  {currentUserEntry.correct_count} of {currentUserEntry.total_questions} correct
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-palette-blush font-mono">
                {currentUserEntry.score.toLocaleString()}
              </span>
              <span className="block text-[10px] text-palette-slate uppercase font-bold">pts</span>
            </div>
          </div>
        )}

        {/* Top 3 Podium Cards */}
        {leaderboard.length > 0 && (
          <div className="grid grid-cols-3 gap-2 items-end pt-3 pb-1">
            {/* 2nd Place */}
            <div className="order-1 flex flex-col items-center">
              {leaderboard[1] ? (
                <>
                  <div className="text-[11px] font-bold text-palette-slate truncate w-full mb-1">
                    {leaderboard[1].nickname}
                  </div>
                  <div className="w-full bg-palette-blueslate/30 border border-palette-blueslate/50 rounded-2xl p-2.5 flex flex-col items-center justify-center h-28 shadow-sm">
                    <Medal className="w-5 h-5 text-palette-slate mb-1" />
                    <span className="text-lg font-black text-palette-blush font-mono">2nd</span>
                    <span className="text-[11px] font-mono font-bold text-palette-slate">
                      {leaderboard[1].score}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-20 opacity-0" />
              )}
            </div>

            {/* 1st Place */}
            <div className="order-2 flex flex-col items-center">
              {leaderboard[0] && (
                <>
                  <Crown className="w-6 h-6 text-palette-blush animate-bounce mb-1" />
                  <div className="text-xs font-black text-palette-blush truncate w-full mb-1">
                    {leaderboard[0].nickname}
                  </div>
                  <div className="w-full bg-palette-grape border border-palette-blush/60 rounded-2xl p-3 flex flex-col items-center justify-center h-36 shadow-lg">
                    <Trophy className="w-6 h-6 text-palette-blush mb-1" />
                    <span className="text-2xl font-black text-palette-blush font-mono">1st</span>
                    <span className="text-xs font-mono font-black text-palette-blush">
                      {leaderboard[0].score}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* 3rd Place */}
            <div className="order-3 flex flex-col items-center">
              {leaderboard[2] ? (
                <>
                  <div className="text-[11px] font-bold text-palette-slate truncate w-full mb-1">
                    {leaderboard[2].nickname}
                  </div>
                  <div className="w-full bg-[#7a5882]/30 border border-[#7a5882]/50 rounded-2xl p-2.5 flex flex-col items-center justify-center h-24 shadow-sm">
                    <Medal className="w-4 h-4 text-palette-slate mb-1" />
                    <span className="text-base font-black text-palette-blush font-mono">3rd</span>
                    <span className="text-[10px] font-mono font-bold text-palette-slate">
                      {leaderboard[2].score}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-20 opacity-0" />
              )}
            </div>
          </div>
        )}

        {/* All Remaining Ranks */}
        <div className="space-y-2 text-left max-h-48 overflow-y-auto pr-1">
          {leaderboard.map((entry) => {
            const isMe = entry.voter_token === voterToken || entry.nickname === nickname;
            return (
              <div
                key={entry.rank}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                  isMe
                    ? 'bg-palette-grape/40 border-palette-blush/50 text-palette-blush font-bold'
                    : 'bg-palette-charcoal/80 border-palette-blueslate/30 text-palette-slate'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="w-6 h-6 rounded-lg bg-palette-charcoal border border-palette-blueslate/30 flex items-center justify-center font-mono font-bold text-[11px] text-palette-blush shrink-0">
                    {entry.rank}
                  </span>
                  <span className="truncate">{entry.nickname} {isMe && '(You)'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono">
                  <span className="text-[11px] text-palette-slate font-sans">
                    {entry.correct_count}/{entry.total_questions}
                  </span>
                  <span className="font-bold text-palette-blush">
                    {entry.score.toLocaleString()} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-palette-blush bg-palette-blueslate/20 border border-palette-blueslate/30 px-2.5 py-1 rounded-xl">
            <User className="w-3 h-3 text-palette-slate" />
            {nickname}
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
              <h3 className="text-lg font-bold text-palette-blush">Answer Submitted!</h3>
              <p className="text-xs text-palette-slate mt-1 leading-relaxed">
                Watch the screen for live results. The next question and final leaderboard will appear automatically!
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

