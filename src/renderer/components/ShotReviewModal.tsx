import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, Sparkles } from 'lucide-react';

interface ShotReviewModalProps {
  photoPath: string;
  currentPose: number;
  totalPoses: number;
  retakeCount: number;
  onRetake: () => void;
  onAccept: () => void;
}

export const ShotReviewModal: React.FC<ShotReviewModalProps> = ({
  photoPath,
  currentPose,
  totalPoses,
  retakeCount,
  onRetake,
  onAccept,
}) => {
  const [autoSeconds, setAutoSeconds] = useState(4);

  // Auto accept after 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onAccept();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onAccept]);

  // Transform local path to URL
  const photoUrl = photoPath ? `/output/sessions/${photoPath.split('/sessions/')[1]}` : '';

  return (
    <div className="relative w-full h-full bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-8 z-40">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-4xl pt-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-pink-400" />
          <h2 className="text-2xl font-display font-extrabold text-white">
            Hasil Pose {currentPose + 1} dari {totalPoses}
          </h2>
        </div>
        <div className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-mono text-gray-300">
          Lanjut otomatis dalam: <span className="text-pink-400 font-bold">{autoSeconds}s</span>
        </div>
      </div>

      {/* Captured High-Res Photo Preview */}
      <div className="max-h-[65vh] aspect-[2/3] rounded-3xl overflow-hidden border-4 border-pink-500/50 shadow-2xl bg-gray-900 flex items-center justify-center">
        {photoUrl ? (
          <img src={photoUrl} alt="Review Shot" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500">Memuat foto...</div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center gap-6 pb-6 w-full max-w-md">
        {retakeCount === 0 && (
          <button
            onClick={onRetake}
            className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <RotateCcw className="w-5 h-5 text-yellow-400" />
            <span>Foto Ulang</span>
          </button>
        )}

        <button
          onClick={onAccept}
          className="flex-1 py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-2xl font-display font-bold text-xl shadow-xl shadow-pink-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Check className="w-6 h-6 stroke-[3]" />
          <span>Suka, Lanjut!</span>
        </button>
      </div>
    </div>
  );
};
