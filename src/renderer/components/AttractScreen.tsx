import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface AttractScreenProps {
  onStart: () => void;
  onAdminTap: () => void;
}

export const AttractScreen: React.FC<AttractScreenProps> = ({ onStart, onAdminTap }) => {
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Ignore taps inside the hidden top-left admin hotspot (first 96px x 96px)
    if (e.clientX < 96 && e.clientY < 96) return;
    if (isStarting) return;
    setIsStarting(true);
    onStart();
    // Safety reset after 4 seconds in case session was cancelled or failed
    setTimeout(() => setIsStarting(false), 4000);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black cursor-pointer select-none"
      onClick={handleStart}
    >
      {/* Hidden Operator Hotspot (Tap 5x in top-left to open Admin) */}
      <div
        className="absolute top-0 left-0 w-24 h-24 z-50 opacity-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onAdminTap();
        }}
      />

      {/* Video Background (Desain tanpa judul.mp4) */}
      <video
        src="/videos/attract.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover pointer-events-none"
      />

      {/* Gradient Overlay & Touch CTA */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col items-center justify-end pb-24 pointer-events-none">
        <div className="flex flex-col items-center gap-4 animate-bounce">
          <div className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full text-white font-display text-2xl font-bold shadow-2xl pulse-glow tracking-wider">
            <Sparkles className="w-7 h-7 text-yellow-300 animate-spin" style={{ animationDuration: '4s' }} />
            <span>TOUCH SCREEN TO START</span>
            <ArrowRight className="w-7 h-7" />
          </div>
          <p className="text-gray-300 text-lg font-medium drop-shadow-md">
            Pilih Template Favorit & Abadikan Momen Terbaikmu!
          </p>
        </div>
      </div>
    </div>
  );
};
