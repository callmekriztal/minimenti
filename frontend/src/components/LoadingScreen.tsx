import React from 'react';
import { Radio } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading MiniMenti...',
  subtext = 'Connecting to real-time presentation engine',
  fullScreen = true,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300 ${
        fullScreen ? 'min-h-[100dvh] bg-palette-charcoal text-palette-blush' : 'py-16'
      }`}
    >
      <div className="relative mb-6">
        {/* Glowing aura */}
        <div className="absolute -inset-4 rounded-3xl bg-palette-grape/30 blur-xl animate-pulse" />

        {/* Squircle logo */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-palette-grape text-palette-blush flex items-center justify-center shadow-2xl border border-palette-blush/30 animate-brand-pulse">
          <span className="font-black text-3xl sm:text-4xl tracking-tight select-none">M</span>
          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-palette-blush animate-ping" />
        </div>
      </div>

      {/* Brand title */}
      <div className="flex items-center gap-2 mb-1.5">
        <h1 className="text-xl sm:text-2xl font-black text-palette-blush tracking-tight">MiniMenti</h1>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-palette-blueslate/30 border border-palette-blueslate/40 text-[10px] font-bold uppercase tracking-wider text-palette-slate">
          <Radio className="w-2.5 h-2.5 text-palette-blush animate-pulse" /> Live
        </span>
      </div>

      {/* Dynamic Status message */}
      <p className="text-sm font-semibold text-palette-slate max-w-xs">{message}</p>
      {subtext && <p className="text-[11px] font-mono text-palette-slate/70 mt-1">{subtext}</p>}

      {/* Animated shimmer progress bar */}
      <div className="w-48 h-1.5 bg-palette-blueslate/30 rounded-full overflow-hidden mt-6 border border-palette-blueslate/40">
        <div className="w-1/2 h-full bg-gradient-to-r from-palette-grape via-palette-blush to-palette-grape rounded-full animate-shimmer" />
      </div>
    </div>
  );
};
