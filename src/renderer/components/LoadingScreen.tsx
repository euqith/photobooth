import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  onCancel?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Menyiapkan Sesi Photobooth...',
  subMessage = 'Sedang membuat kode QRIS resmi dan menghubungkan ke server...',
  onCancel,
}) => {
  // Prevent instant accidental touch-through cancellation by delaying cancel button by 4 seconds
  const [canCancel, setCanCancel] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanCancel(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-40 bg-[#080B11]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in select-none"
    >
      <div className="flex flex-col items-center max-w-md w-full text-center">
        {/* Animated Glowing Ring & Icons */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="w-28 h-28 rounded-full border-4 border-pink-500/20 border-t-pink-500 animate-spin" />
          <div className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-pink-600/30 to-rose-500/30 blur-xl animate-pulse" />
          <div className="absolute w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-pink-500/30 animate-bounce">
            <Sparkles className="w-8 h-8" />
          </div>
        </div>

        {/* Status Text */}
        <h2 className="text-2xl font-display font-black text-white tracking-wide mb-2">
          {message}
        </h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          {subMessage}
        </p>

        {/* Progress Dots Indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping" />
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <div className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse" />
        </div>

        {/* Cancel Button - Only visible after 4s to prevent touch-through from AttractScreen */}
        {onCancel && canCancel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-gray-700/60 cursor-pointer animate-fade-in"
          >
            <X className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>
        )}
      </div>
    </div>
  );
};
