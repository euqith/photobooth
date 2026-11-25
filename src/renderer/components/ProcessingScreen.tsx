import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export const ProcessingScreen: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Video Loop Background (Desain tanpa judul (1).mp4) */}
      <video
        src="/videos/processing.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover pointer-events-none opacity-80"
      />

      {/* Loading Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/80 flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-pink-500/20 border-2 border-pink-500 pulse-glow">
          <Loader2 className="w-10 h-10 text-pink-400 animate-spin" />
        </div>

        <div className="text-center">
          <h2 className="text-4xl font-display font-extrabold text-white flex items-center justify-center gap-3 drop-shadow-lg">
            <Sparkles className="w-8 h-8 text-yellow-300 animate-bounce" />
            Merangkai Kolase Foto...
          </h2>
          <p className="text-gray-300 text-lg mt-2 font-medium">
            Tunggu sebentar, cetakan magismu sedang disiapkan!
          </p>
        </div>
      </div>
    </div>
  );
};
