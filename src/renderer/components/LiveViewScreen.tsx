import React, { useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';

interface LiveViewScreenProps {
  currentPose: number;
  totalPoses: number;
  countdown: number;
  isFlashing: boolean;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({
  currentPose,
  totalPoses,
  countdown,
  isFlashing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false);

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
      {/* Live View Canvas (Horizontally Mirrored) */}
      <canvas
        ref={canvasRef}
        id="liveview-canvas"
        width={1280}
        height={853}
        className="w-full h-full object-cover transform scale-x-[-1]"
      />

      {/* Camera Initializing Loader while mirror is flipping */}
      {!hasReceivedFrame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-sm pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-pink-500 border-t-transparent animate-spin mb-4" />
          <p className="text-gray-300 font-semibold text-sm">Menghubungkan Kamera Canon 6D...</p>
        </div>
      )}

      {/* Camera Slot Framing Guide Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[420px] h-[580px] border-4 border-dashed border-white/40 rounded-3xl relative">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-black/80 px-4 py-1 rounded-full text-xs font-semibold text-gray-300 uppercase tracking-widest border border-white/20">
            Area Foto Kolase
          </div>
        </div>
      </div>

      {/* Top Header: Pose Counter Badge */}
      <div className="absolute top-8 left-8 flex items-center gap-3 bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
        <Camera className="w-6 h-6 text-pink-400" />
        <span className="text-xl font-display font-extrabold text-white">
          Pose {currentPose + 1} <span className="text-gray-400">/ {totalPoses}</span>
        </span>
      </div>

      {/* Giant Animated Countdown Number */}
      {countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
