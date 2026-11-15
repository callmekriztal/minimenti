import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Copy, Check, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { PollRead } from '../types';

interface CreatePollProps {
  onPollCreated: (poll: PollRead) => void;
}

export const CreatePoll: React.FC<CreatePollProps> = ({ onPollCreated }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPoll, setCreatedPoll] = useState<PollRead | null>(null);
  const [copiedLink, setCopiedLink] = useState<'voter' | 'presenter' | null>(null);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    const cleanOptions = options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);

    if (!trimmedQuestion) {
      setError('Please provide a question.');
      return;
    }
    if (cleanOptions.length < 2) {
      setError('Please provide at least 2 non-empty options.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedQuestion, options: cleanOptions }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ? JSON.stringify(data.detail) : 'Failed to create poll');
      }

      const poll: PollRead = await res.json();
      if (poll.admin_key) {
        localStorage.setItem(`admin_key_${poll.id}`, poll.admin_key);
      }
      setCreatedPoll(poll);
      onPollCreated(poll);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'voter' | 'presenter') => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (createdPoll) {
    const voterUrl = `${window.location.origin}/?view=vote&poll_id=${createdPoll.id}`;
    const presenterUrl = `${window.location.origin}/?view=present&poll_id=${createdPoll.id}&admin_key=${createdPoll.admin_key}`;

    return (
      <div className="w-full max-w-xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20 text-white font-black text-2xl">
            ✓
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your Poll is Live!</h2>
          <p className="text-slate-400 text-sm mt-1">Open the presenter screen on your projector, and share the voter link with your audience.</p>
        </div>

        <div className="space-y-4 mb-8">
          {/* Voter Link */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 transition hover:border-slate-700">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Audience Voting Link</span>
              <span className="text-[10px] text-slate-500 font-normal">Share this with voters</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={voterUrl}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(voterUrl, 'voter')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                {copiedLink === 'voter' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink === 'voter' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Presenter Link */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/30 border border-indigo-900/40 rounded-2xl p-4 transition hover:border-indigo-700/50">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Presenter Screen (With Admin Controls)</span>
              <span className="text-[10px] text-indigo-300/70 font-normal">For projector / slide display</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={presenterUrl}
                className="flex-1 bg-slate-950/80 border border-indigo-900/50 rounded-xl px-3 py-2 text-xs font-mono text-indigo-200 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(presenterUrl, 'presenter')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
              >
                {copiedLink === 'presenter' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink === 'presenter' ? 'Copied' : 'Copy'}
              </button>
              <a
                href={presenterUrl}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCreatedPoll(null)}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition"
          >
            Create Another Poll
          </button>
          <a
            href={presenterUrl}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
          >
            <span>Launch Presentation</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-indigo-950/20">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Live Interactive Polling
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Create a Poll</h1>
        <p className="text-slate-400 text-sm mt-1.5">Ask a question, collect live votes, and project instant animated results.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="poll-question" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Question
          </label>
          <input
            id="poll-question"
            type="text"
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is your favourite database?"
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-slate-500 px-4 py-3.5 rounded-2xl text-base transition outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Options ({options.length}/10)
            </label>
            <span className="text-[11px] text-slate-500">Min 2, Max 10</span>
          </div>

          <div className="space-y-2.5">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-400">
                  {idx + 1}
                </div>
                <input
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-slate-500 px-4 py-2.5 rounded-xl text-sm transition outline-none"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                    title="Remove option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="mt-3.5 w-full py-2.5 px-4 bg-slate-800/50 hover:bg-slate-800 border border-dashed border-slate-700/80 hover:border-indigo-500/60 text-slate-300 hover:text-indigo-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Option
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/30 transition duration-150 flex items-center justify-center gap-2 group disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Launch Live Poll</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
