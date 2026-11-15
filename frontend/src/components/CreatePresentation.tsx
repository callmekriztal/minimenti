import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Layers, HelpCircle } from 'lucide-react';
import { PresentationCreated } from '../types';

interface QuestionDraft {
  question: string;
  options: string[];
}

interface CreatePresentationProps {
  onPresentationCreated: (presentation: PresentationCreated) => void;
}

export const CreatePresentation: React.FC<CreatePresentationProps> = ({ onPresentationCreated }) => {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { question: '', options: ['', ''] },
  ]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQuestion = questions[currentSlideIndex];

  const handleAddQuestion = () => {
    if (questions.length >= 20) return;
    const updated = [...questions, { question: '', options: ['', ''] }];
    setQuestions(updated);
    setCurrentSlideIndex(updated.length - 1);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setCurrentSlideIndex(Math.max(0, Math.min(currentSlideIndex, updated.length - 1)));
  };

  const handleUpdateQuestionText = (text: string) => {
    const updated = [...questions];
    updated[currentSlideIndex].question = text;
    setQuestions(updated);
  };

  const handleAddOption = () => {
    if (activeQuestion.options.length >= 10) return;
    const updated = [...questions];
    updated[currentSlideIndex].options.push('');
    setQuestions(updated);
  };

  const handleRemoveOption = (optIdx: number) => {
    if (activeQuestion.options.length <= 2) return;
    const updated = [...questions];
    updated[currentSlideIndex].options = updated[currentSlideIndex].options.filter((_, i) => i !== optIdx);
    setQuestions(updated);
  };

  const handleOptionChange = (optIdx: number, val: string) => {
    const updated = [...questions];
    updated[currentSlideIndex].options[optIdx] = val;
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please provide a presentation title.');
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        setError(`Question ${i + 1} has an empty question text.`);
        setCurrentSlideIndex(i);
        return;
      }
      const cleanOpts = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
      if (cleanOpts.length < 2) {
        setError(`Question ${i + 1} must have at least 2 non-empty options.`);
        setCurrentSlideIndex(i);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        title: trimmedTitle,
        polls: questions.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
        })),
      };

      const res = await fetch('/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ? JSON.stringify(errData.detail) : 'Failed to create presentation');
      }

      const created: PresentationCreated = await res.json();
      localStorage.setItem(`pres_admin_key_${created.id}`, created.admin_key);
      onPresentationCreated(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
          <Layers className="w-3.5 h-3.5" />
          Interactive Presentation Deck
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Create Multi-Question Presentation
        </h1>
        <p className="text-slate-400 text-sm mt-1 max-w-xl mx-auto">
          Prepare your questions ahead of time. Your audience joins once using a 6-digit code or QR code and answers questions live as you advance slides!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Presentation Title */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Presentation Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Product Demo Q&A, Team Trivia, Town Hall Polling"
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition shadow-inner font-medium"
          />
        </div>

        {/* Slide Tabs Navigation */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Slides ({questions.length})
            </span>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slide
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {questions.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 border ${
                  currentSlideIndex === idx
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>Slide {idx + 1}</span>
                {questions.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveQuestion(idx);
                    }}
                    className="hover:text-rose-300 text-slate-500 p-0.5"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Active Slide Editor */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Editing Question {currentSlideIndex + 1} of {questions.length}
            </span>
          </div>

          <div>
            <input
              type="text"
              value={activeQuestion.question}
              onChange={(e) => handleUpdateQuestionText(e.target.value)}
              placeholder="e.g. Which programming language do you prefer?"
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition font-medium"
            />
          </div>

          <div className="space-y-2.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Options (2 to 10)
            </label>
            {activeQuestion.options.map((opt, optIdx) => (
              <div key={optIdx} className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500 w-5 text-right">
                  {optIdx + 1}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                  placeholder={`Option ${optIdx + 1}`}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition"
                />
                {activeQuestion.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIdx)}
                    className="p-2 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {activeQuestion.options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-2 px-1"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Launch Live Presentation Deck
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
