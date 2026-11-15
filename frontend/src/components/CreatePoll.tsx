import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
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
      <div className="w-full max-w-lg mx-auto glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-palette-grape rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg text-palette-blush font-black text-xl">
            ✓
          </div>
          <h2 className="text-2xl font-black text-palette-blush tracking-tight">Poll is Live</h2>
          <p className="text-palette-slate text-xs mt-1">Open presenter view or share the link with voters.</p>
        </div>

        <div className="space-y-3 mb-6">
          {/* Voter Link */}
          <div className="bg-palette-charcoal/80 border border-palette-blueslate/40 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold text-palette-slate uppercase tracking-wider block mb-1.5">
              Audience Voting Link
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={voterUrl}
                className="flex-1 bg-palette-charcoal border border-palette-blueslate/30 rounded-xl px-3 py-2 text-xs font-mono text-palette-blush select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(voterUrl, 'voter')}
                className="px-3.5 py-2 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {copiedLink === 'voter' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink === 'voter' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Presenter Link */}
          <div className="bg-palette-charcoal/80 border border-palette-blueslate/40 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold text-palette-slate uppercase tracking-wider block mb-1.5">
              Presenter Screen (With Admin Controls)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={presenterUrl}
                className="flex-1 bg-palette-charcoal border border-palette-blueslate/30 rounded-xl px-3 py-2 text-xs font-mono text-palette-blush select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(presenterUrl, 'presenter')}
                className="px-3.5 py-2 bg-palette-blueslate/40 hover:bg-palette-blueslate/60 text-palette-blush rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-palette-blueslate/50"
              >
                {copiedLink === 'presenter' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink === 'presenter' ? 'Copied' : 'Copy'}
              </button>
              <a
                href={presenterUrl}
                className="px-3.5 py-2 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreatedPoll(null)}
          className="w-full py-3 px-4 bg-palette-blueslate/30 hover:bg-palette-blueslate/40 text-palette-blush font-semibold text-xs rounded-xl transition"
        >
          Create Another Poll
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-palette-grape/30 border border-palette-grape/40 text-palette-blush text-[11px] font-bold rounded-full uppercase tracking-wider mb-2">
          <Sparkles className="w-3 h-3 text-palette-slate" />
          Single Question
        </span>
        <h2 className="text-2xl sm:text-3xl font-black text-palette-blush tracking-tight">Create a Quick Poll</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-palette-grape/40 border border-palette-blush/30 rounded-xl text-palette-blush text-xs font-medium">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="poll-question" className="block text-xs font-bold text-palette-slate uppercase tracking-wider mb-2">
            Question
          </label>
          <input
            id="poll-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Which topic should we review today?"
            className="w-full bg-palette-charcoal/90 border border-palette-blueslate/40 focus:border-palette-blush text-palette-blush placeholder-palette-slate/50 px-4 py-3 rounded-2xl text-sm transition outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-palette-slate uppercase tracking-wider">
              Options
            </label>
            <span className="text-[11px] text-palette-slate/70">Min 2, Max 10</span>
          </div>

          <div className="space-y-2">
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-palette-blueslate/20 border border-palette-blueslate/30 flex items-center justify-center text-xs font-bold text-palette-slate">
                  {String.fromCharCode(65 + index)}
                </div>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 bg-palette-charcoal/90 border border-palette-blueslate/40 focus:border-palette-blush text-palette-blush placeholder-palette-slate/50 px-3.5 py-2 rounded-xl text-xs transition outline-none"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-1.5 text-palette-slate hover:text-palette-blush transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 w-full py-2 bg-palette-blueslate/20 hover:bg-palette-blueslate/30 border border-dashed border-palette-blueslate/40 text-palette-slate hover:text-palette-blush text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Option
              </button>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[50px] px-6 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush font-bold text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-palette-blush/30 border-t-palette-blush rounded-full animate-spin" />
          ) : (
            <>
              Launch Poll
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
