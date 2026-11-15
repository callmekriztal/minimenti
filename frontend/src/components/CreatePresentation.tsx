import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Layers, HelpCircle, Check } from 'lucide-react';
import { PresentationCreated } from '../types';

interface QuestionDraft {
  question: string;
  options: string[];
  correctOptionIndex: number | null;
}

interface CreatePresentationProps {
  onPresentationCreated: (presentation: PresentationCreated) => void;
}

export const CreatePresentation: React.FC<CreatePresentationProps> = ({ onPresentationCreated }) => {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { question: '', options: ['', ''], correctOptionIndex: 0 },
  ]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQuestion = questions[currentSlideIndex];

  const handleAddQuestion = () => {
    if (questions.length >= 20) return;
    const updated = [...questions, { question: '', options: ['', ''], correctOptionIndex: 0 }];
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
    if (updated[currentSlideIndex].correctOptionIndex === optIdx) {
      updated[currentSlideIndex].correctOptionIndex = 0;
    } else if (
      updated[currentSlideIndex].correctOptionIndex !== null &&
      updated[currentSlideIndex].correctOptionIndex! > optIdx
    ) {
      updated[currentSlideIndex].correctOptionIndex = updated[currentSlideIndex].correctOptionIndex! - 1;
    }
    setQuestions(updated);
  };

  const handleOptionChange = (optIdx: number, val: string) => {
    const updated = [...questions];
    updated[currentSlideIndex].options[optIdx] = val;
    setQuestions(updated);
  };

  const handleToggleCorrectOption = (optIdx: number) => {
    const updated = [...questions];
    updated[currentSlideIndex].correctOptionIndex =
      updated[currentSlideIndex].correctOptionIndex === optIdx ? null : optIdx;
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please provide a title.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        setError(`Question ${i + 1} is empty.`);
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
          correct_option_index: q.correctOptionIndex,
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
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-palette-grape/30 border border-palette-grape/40 text-palette-blush text-xs font-bold rounded-full uppercase tracking-wider mb-2">
          <Layers className="w-3.5 h-3.5" />
          Interactive Deck
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-palette-blush tracking-tight">
          Create Presentation
        </h1>
        <p className="text-palette-slate text-xs sm:text-sm">
          Prepare slides with multiple questions. Audience joins once.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
        {error && (
          <div className="p-3.5 bg-palette-grape/40 border border-palette-blush/30 rounded-2xl text-palette-blush text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold text-palette-slate uppercase tracking-wider mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Review, Team Trivia"
            className="w-full bg-palette-charcoal/90 border border-palette-blueslate/40 focus:border-palette-blush rounded-2xl px-4 py-3 text-sm text-palette-blush placeholder-palette-slate/50 focus:outline-none transition font-medium"
          />
        </div>

        {/* Slides Navigation */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-palette-slate uppercase tracking-wider">
              Slides ({questions.length})
            </span>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="text-xs font-bold text-palette-blush hover:text-white flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slide
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {questions.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 border ${
                  currentSlideIndex === idx
                    ? 'bg-palette-grape text-palette-blush border-palette-blush/40 shadow-sm'
                    : 'bg-palette-charcoal text-palette-slate border-palette-blueslate/30 hover:border-palette-slate'
                }`}
              >
                <span>Slide {idx + 1}</span>
                {questions.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveQuestion(idx);
                    }}
                    className="hover:text-palette-blush text-palette-slate px-0.5"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Slide Content Editor */}
        <div className="bg-palette-charcoal/80 border border-palette-blueslate/30 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-palette-blush uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-palette-slate" />
              Question {currentSlideIndex + 1}
            </span>
          </div>

          <div>
            <input
              type="text"
              value={activeQuestion.question}
              onChange={(e) => handleUpdateQuestionText(e.target.value)}
              placeholder="Question text"
              className="w-full bg-palette-charcoal border border-palette-blueslate/40 focus:border-palette-blush rounded-xl px-3.5 py-2.5 text-sm text-palette-blush placeholder-palette-slate/50 focus:outline-none transition font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-palette-slate uppercase tracking-wider">
              Options
            </label>
            {activeQuestion.options.map((opt, optIdx) => {
              const isCorrect = activeQuestion.correctOptionIndex === optIdx;
              return (
                <div key={optIdx} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-palette-slate w-4 text-right">
                    {optIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                    placeholder={`Option ${optIdx + 1}`}
                    className={`flex-1 bg-palette-charcoal border rounded-xl px-3.5 py-2 text-xs text-palette-blush placeholder-palette-slate/50 focus:outline-none transition ${
                      isCorrect ? 'border-palette-grape ring-1 ring-palette-grape/50' : 'border-palette-blueslate/40 focus:border-palette-blush'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleCorrectOption(optIdx)}
                    title={isCorrect ? "Correct Answer (Click to unmark)" : "Click to set as Correct Answer"}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                      isCorrect
                        ? 'bg-palette-grape text-palette-blush border border-palette-blush shadow-md'
                        : 'bg-palette-blueslate/20 hover:bg-palette-blueslate/30 text-palette-slate border border-palette-blueslate/40'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${isCorrect ? 'text-palette-blush' : 'text-palette-slate'}`} />
                    <span className="text-[11px] hidden sm:inline">
                      {isCorrect ? 'Correct' : 'Mark Correct'}
                    </span>
                  </button>
                  {activeQuestion.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(optIdx)}
                      className="p-1.5 text-palette-slate hover:text-palette-blush transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}


            {activeQuestion.options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-xs font-bold text-palette-slate hover:text-palette-blush flex items-center gap-1 mt-1 pt-1"
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
          className="w-full min-h-[50px] px-6 bg-palette-grape hover:bg-palette-grape/80 text-palette-blush font-bold text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-palette-blush/30 border-t-palette-blush rounded-full animate-spin" />
          ) : (
            <>
              Launch Presentation
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
