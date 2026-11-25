import React, { useRef, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { PhotoboothState, SlotBox } from '../../shared/types';

interface LiveViewScreenProps {
  currentPose: number;
  totalPoses: number;
  countdown: number;
  isFlashing: boolean;
  state: PhotoboothState;
  activeSlot?: SlotBox;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({
  currentPose,
  totalPoses,
  countdown,
  isFlashing,
  state,
  activeSlot,
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
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
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
            width: isLandscape ? 'min(760px, 78vw)' : undefined,
            height: !isLandscape ? 'min(640px, 75vh)' : undefined,
            maxHeight: '75vh',
            maxWidth: '82vw',
          }}
          className="border-4 border-dashed border-pink-400/80 rounded-3xl relative shadow-[0_0_35px_rgba(244,63,94,0.25)] transition-all duration-500 ease-out flex items-center justify-center"
        >
          {/* Subtle Corner Markers */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-pink-500 rounded-tl-2xl" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-pink-500 rounded-tr-2xl" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-pink-500 rounded-bl-2xl" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-pink-500 rounded-br-2xl" />

          {/* Center Subtle Framing Oval Guide */}
          <div className="w-40 h-52 rounded-full border border-white/20 pointer-events-none" />

          {/* Top Label Badge */}
          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 bg-black/90 px-4 py-1 rounded-full text-xs font-bold text-pink-400 uppercase tracking-wider border border-pink-500/50 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
            <span>Area Foto Kolase ({isLandscape ? 'Landscape' : isSquare ? 'Persegi' : 'Portrait'})</span>
          </div>
        </div>
      </div>

      {/* Preparatory "SIAP-SIAP!" Breather Banner before countdown begins */}
      {state === 'LIVEVIEW_PREP' && hasReceivedFrame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 backdrop-blur-[2px] pointer-events-none z-30 animate-fade-in">
          <div className="bg-black/90 border-2 border-pink-500/80 px-10 py-6 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-pulse">
            <div className="flex items-center gap-2 text-pink-400 font-extrabold text-xs uppercase tracking-widest mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping" />
              Kamera Canon 6D Siap
            </div>
            <h2 className="text-4xl font-display font-black text-white tracking-wide">
              SIAP-SIAP!
            </h2>
            <p className="text-gray-300 text-sm mt-2 max-w-xs">
              Atur posisimu di dalam kotak panduan. Hitungan mundur akan segera dimulai!
            </p>
          </div>
        </div>
      )}

      {/* Top Header: Pose Counter Badge */}
      <div className="absolute top-8 left-8 flex items-center gap-3 bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl z-20">
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
            className="w-48 h-48 rounded-full bg-black/60 backdrop-blur-xl border-4 border-pink-500 flex items-center justify-center shadow-2xl animate-ping"
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
