import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { PhotoboothState, PhotoSession, TemplateMetadata, ColorFilter } from '../shared/types';
import { AttractScreen } from './components/AttractScreen';
import { TemplateSelectorScreen } from './components/TemplateSelectorScreen';
import { LiveViewScreen } from './components/LiveViewScreen';
import { ShotReviewModal } from './components/ShotReviewModal';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ResultShareScreen } from './components/ResultShareScreen';
import { AdminDashboard } from './components/AdminDashboard';

export const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<PhotoboothState>('IDLE');
  const [session, setSession] = useState<PhotoSession | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [showAdmin, setShowAdmin] = useState<boolean>(false);
  const [adminTapCount, setAdminTapCount] = useState<number>(0);

  // Initialize Socket.io connection
  useEffect(() => {
    // If running in Vite dev server (port 5173), point to backend at 4000
    const serverUrl = window.location.port === '5173' ? 'http://localhost:4000' : window.location.origin;
    const s = io(serverUrl);
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to Photobooth Backend Socket');
    });

    s.on('session:state', (data: { session: PhotoSession | null; state: PhotoboothState; countdown: number }) => {
      setSession(data.session);
      setState(data.state);
      setCountdown(data.countdown || 0);
    });

    s.on('session:countdown_tick', (data: { count: number }) => {
      setCountdown(data.count);
    });

    s.on('session:flash', () => {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 500);
    });

    s.on('camera:frame', async (frameBuffer: ArrayBuffer) => {
      window.dispatchEvent(new CustomEvent('camera:frame_received'));
      const canvas = document.getElementById('liveview-canvas') as HTMLCanvasElement | null;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const blob = new Blob([frameBuffer], { type: 'image/jpeg' });
        const bitmap = await createImageBitmap(blob);
        if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
      } catch (err) {
        // frame render error
      }
    });

    // Fetch templates catalog
    fetch(`${serverUrl}/api/templates`)
      .then((res) => res.json())
      .then((data: TemplateMetadata[]) => {
        setTemplates(data);
      })
      .catch((err) => console.error('Error fetching templates:', err));

    return () => {
      s.disconnect();
    };
  }, []);

  const handleAdminTap = () => {
    setAdminTapCount((prev) => {
      if (prev + 1 >= 5) {
        setShowAdmin(true);
        return 0;
      }
      return prev + 1;
    });
  };

  const startSession = () => {
    socket?.emit('session:start');
  };

  const selectTemplate = (id: string) => {
    socket?.emit('session:selectTemplate', id);
  };

  const readyLiveView = () => {
    socket?.emit('session:readyLiveView');
  };

  const triggerCountdown = () => {
    socket?.emit('session:startCountdown');
  };

  const retakePose = () => {
    socket?.emit('session:retake');
  };

  const acceptPose = () => {
    socket?.emit('session:acceptPose');
  };

  const applyFilter = (filter: ColorFilter) => {
    socket?.emit('session:applyFilter', filter);
  };

  const printCollage = (copies: number) => {
    socket?.emit('session:print', { copies });
  };

  const endSession = () => {
    socket?.emit('session:done');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans select-none">
      {/* 1. Attract Screen (IDLE) */}
      {state === 'IDLE' && (
        <AttractScreen onStart={startSession} onAdminTap={handleAdminTap} />
      )}

      {/* 2. Template Selection */}
      {state === 'SELECT_TEMPLATE' && (
        <TemplateSelectorScreen
          templates={templates}
          selectedId={session?.templateId || '1'}
          onSelect={selectTemplate}
          onReady={readyLiveView}
          onCancel={endSession}
        />
      )}

      {/* 3. Live View & Countdown */}
      {(state === 'LIVEVIEW_PREP' || state === 'COUNTDOWN' || state === 'CAPTURING') && (
        <LiveViewScreen
          currentPose={session?.currentPose || 0}
          totalPoses={session?.poseCount || 3}
          countdown={countdown}
          isFlashing={isFlashing}
          state={state}
          activeSlot={session?.activeSlot}
          onStartCountdown={triggerCountdown}
        />
      )}

      {/* 4. Quick Review Modal with Retake Option */}
      {state === 'REVIEW_SHOT' && (
        <ShotReviewModal
          photoPath={session?.capturedPhotos[session?.currentPose] || ''}
          currentPose={session?.currentPose || 0}
          totalPoses={session?.poseCount || 3}
          retakeCount={session?.retakeCountForCurrentPose || 0}
          activeSlot={session?.activeSlot}
          onRetake={retakePose}
          onAccept={acceptPose}
        />
      )}

      {/* 5. Processing / Compositing Screen */}
      {state === 'PROCESSING' && <ProcessingScreen />}

      {/* 6. Result, Filter & Silent Print / QR Share */}
      {state === 'RESULT_SHARE' && session && (
        <ResultShareScreen
          sessionId={session.id}
          templateId={session.templateId}
          activeFilter={session.filter}
          onApplyFilter={applyFilter}
          onPrint={printCollage}
          onDone={endSession}
        />
      )}

      {/* 7. Error Screen (Never blank screen) */}
      {state === 'ERROR' && (
        <div className="relative w-screen h-screen bg-gray-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-3xl font-display font-extrabold text-white mb-3">Terjadi Kendala Kamera</h2>
          <p className="text-gray-400 text-sm max-w-md mb-8">
            Kamera DSLR memerlukan jeda transisi atau port USB sedang sibuk. Silakan tekan tombol di bawah untuk mengulang sesi.
          </p>
          <button
            onClick={endSession}
            className="px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl text-white font-bold text-lg shadow-xl shadow-pink-500/25 active:scale-95 transition-all"
          >
            Mulai Ulang Sesi
          </button>
        </div>
      )}

      {/* Hidden Admin Dashboard Modal */}
      {showAdmin && (
        <AdminDashboard
          onClose={() => setShowAdmin(false)}
          onSetCameraProvider={(prov) => socket?.emit('admin:setCameraProvider', prov)}
          onSetPrinterDryRun={(dry) => socket?.emit('admin:setPrinterDryRun', dry)}
          onTestPrint={() => socket?.emit('admin:testPrint')}
          onTestShot={() => socket?.emit('admin:testShot')}
        />
      )}
    </div>
  );
};

export default App;
