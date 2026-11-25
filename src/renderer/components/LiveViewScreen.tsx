import React, { useRef, useEffect, useState } from 'react';
import { Camera, Sparkles } from 'lucide-react';
import { PhotoboothState, SlotBox } from '../../shared/types';

interface LiveViewScreenProps {
  currentPose: number;
  totalPoses: number;
  countdown: number;
  isFlashing: boolean;
  state: PhotoboothState;
  activeSlot?: SlotBox;
  onStartCountdown: () => void;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({
  currentPose,
  totalPoses,
  countdown,
  isFlashing,
  state,
  activeSlot,
  onStartCountdown,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false);

  // Calculate slot aspect ratio (default to landscape 1.37 if not provided)
  const slotRatio = activeSlot && activeSlot.height > 0
    ? activeSlot.width / activeSlot.height
    : 1.37;
  const isLandscape = slotRatio > 1.05;
  const isSquare = slotRatio >= 0.95 && slotRatio <= 1.05;

  // Detect when frame is drawn
  useEffect(() => {
    const handleFrame = () => setHasReceivedFrame(true);
    window.addEventListener('camera:frame_received', handleFrame);
    return () => window.removeEventListener('camera:frame_received', handleFrame);
  }, []);

  // Play audio beep cue on countdown tick
  useEffect(() => {
    if (countdown > 0 && countdown <= 3) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = countdown === 1 ? 880 : 440; // High beep on 1
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch {
        // ignore audio error
      }
    }
  }, [countdown]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden select-none">
      {/* Live View Canvas (Horizontally Mirrored, object-contain to avoid any crop or zoom) */}
      <canvas
        ref={canvasRef}
        id="liveview-canvas"
        width={1056}
        height={704}
        className="w-full h-full object-contain transform scale-x-[-1]"
      />

      {/* Camera Initializing Loader while mirror is flipping */}
      {!hasReceivedFrame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-sm pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full border-4 border-pink-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-300 font-semibold text-sm">Menghubungkan Kamera Canon 6D...</p>
        </div>
      )}

      {/* Dynamic Camera Slot Framing Guide Overlay matching selected template slot ratio */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
        <div
          style={{
            aspectRatio: `${slotRatio}`,
            width: isLandscape ? 'min(820px, 80vw)' : undefined,
            height: !isLandscape ? 'min(620px, 72vh)' : undefined,
            maxHeight: '72vh',
            maxWidth: '82vw',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)', // Dim outside area so crop area is crystal clear
          }}
          className="border-4 border-dashed border-pink-400 rounded-3xl relative transition-all duration-300 ease-out flex items-center justify-center"
        >
          {/* High-visibility Corner Markers */}
          <div className="absolute -top-1.5 -left-1.5 w-8 h-8 border-t-4 border-l-4 border-pink-500 rounded-tl-2xl shadow-lg" />
          <div className="absolute -top-1.5 -right-1.5 w-8 h-8 border-t-4 border-r-4 border-pink-500 rounded-tr-2xl shadow-lg" />
          <div className="absolute -bottom-1.5 -left-1.5 w-8 h-8 border-b-4 border-l-4 border-pink-500 rounded-bl-2xl shadow-lg" />
          <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 border-b-4 border-r-4 border-pink-500 rounded-br-2xl shadow-lg" />

          {/* Top Label Badge */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-black/95 px-5 py-1.5 rounded-full text-xs font-black text-pink-400 uppercase tracking-widest border border-pink-500/60 shadow-2xl flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Area Foto Kolase ({isLandscape ? 'Landscape' : isSquare ? 'Persegi' : 'Portrait'})</span>
          </div>
        </div>
      </div>

      {/* Interactive "AMBIL FOTO" Button during LIVEVIEW_PREP */}
      {state === 'LIVEVIEW_PREP' && countdown === 0 && (
        <div className="absolute bottom-10 inset-x-0 flex flex-col items-center justify-center z-30 pointer-events-auto animate-fade-in">
          <button
            onClick={onStartCountdown}
            className="px-12 py-5 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-full font-display font-black text-2xl shadow-[0_0_50px_rgba(244,63,94,0.7)] flex items-center gap-4 active:scale-95 transition-all cursor-pointer border-3 border-white/50 animate-bounce"
          >
            <Camera className="w-8 h-8" />
            <span>AMBIL FOTO</span>
          </button>
          <span className="text-white text-sm font-bold mt-3 bg-black/80 px-6 py-1.5 rounded-full backdrop-blur-md border border-white/20 shadow-lg">
            Atur posisimu di dalam kotak, lalu sentuh tombol untuk mulai!
          </span>
        </div>
      )}

      {/* Top Header: Pose Counter Badge */}
      <div className="absolute top-8 left-8 flex items-center gap-3 bg-black/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl z-20">
        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
        <Camera className="w-6 h-6 text-pink-400" />
        <span className="text-xl font-display font-extrabold text-white">
          Pose {currentPose + 1} <span className="text-gray-400">/ {totalPoses}</span>
        </span>
      </div>

      {/* Giant Animated Countdown Number */}
      {countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div
            key={countdown}
            className="w-48 h-48 rounded-full bg-black/70 backdrop-blur-xl border-4 border-pink-500 flex items-center justify-center shadow-2xl animate-ping"
            style={{ animationDuration: '0.9s' }}
          >
            <span className="text-8xl font-display font-black text-white drop-shadow-2xl">
              {countdown}
            </span>
          </div>
        </div>
      )}

      {/* White Screen Flash Transition on Shutter Release */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-50 flash-screen pointer-events-none" />
      )}
    </div>
  );
};
