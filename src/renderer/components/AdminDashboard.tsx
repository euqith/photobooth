import React, { useState, useEffect } from 'react';
import { X, Camera, Printer, RotateCcw, Check, Shield } from 'lucide-react';
import { CameraStatus, PrinterStatus } from '../../shared/types';

interface AdminDashboardProps {
  onClose: () => void;
  onSetCameraProvider: (provider: 'mock' | 'gphoto2' | 'edsdk') => void;
  onSetPrinterDryRun: (dryRun: boolean) => void;
  onTestPrint: () => void;
  onTestShot?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  onSetCameraProvider,
  onSetPrinterDryRun,
  onTestPrint,
}) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [activeProvider, setActiveProvider] = useState<'mock' | 'gphoto2'>('mock');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testShotResult, setTestShotResult] = useState<string | null>(null);

  const correctPin = '1234';

  const fetchStatus = () => {
    setIsRefreshing(true);
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.camera) {
          setCameraStatus(data.camera);
          if (data.camera.model?.includes('Mock')) {
            setActiveProvider('mock');
          } else if (data.camera.model?.includes('gphoto2')) {
            setActiveProvider('gphoto2');
          }
        }
        if (data.printer) setPrinterStatus(data.printer);
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setIsAuthenticated(true);
    } else {
      alert('PIN Salah!');
      setPin('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
          <Shield className="w-12 h-12 text-pink-500 mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Operator Admin</h2>
          <p className="text-gray-400 text-xs mb-6 text-center">Masukkan 4-digit PIN operator (default: 1234)</p>

          <form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4">
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoFocus
              className="w-full text-center text-3xl tracking-widest py-3 bg-gray-800 border border-gray-700 rounded-2xl text-white font-mono focus:outline-none focus:border-pink-500"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-pink-500/20"
              >
                Masuk
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-50 flex flex-col p-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-pink-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Operator Admin Dashboard</h1>
            <p className="text-gray-400 text-xs">Diagnostik Hardware DSLR & Pengaturan Printer</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-3 bg-gray-800 hover:bg-gray-700 rounded-2xl text-gray-300 active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Grid Settings */}
      <div className="grid grid-cols-2 gap-8 py-8 flex-1 overflow-y-auto">
        {/* Camera Diagnostics Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Camera className="w-6 h-6 text-pink-400" />
                <h2 className="text-lg font-bold text-white">DSLR Camera Diagnostics</h2>
              </div>
              <button
                onClick={fetchStatus}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 rounded-xl transition-all"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Mengecek...' : 'Cek Ulang'}</span>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Model:</span>
                <span className="font-semibold text-white">{cameraStatus?.model || 'Detecting...'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Status USB:</span>
                {cameraStatus?.connected ? (
                  <span className="font-bold text-green-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    Connected & Ready
                  </span>
                ) : (
                  <span className="font-bold text-rose-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Disconnected / Not Detected
                  </span>
                )}
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Power:</span>
                <span className="font-semibold text-yellow-300">
                  {cameraStatus?.batteryLevel || (cameraStatus?.connected ? 'AC Dummy Battery' : 'N/A')}
                </span>
              </div>
            </div>

            {/* Error / Instruction Warning Banner if Disconnected */}
            {!cameraStatus?.connected && activeProvider === 'gphoto2' && (
              <div className="mt-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-200">
                <p className="font-bold mb-1">⚠️ Kamera Canon 6D Belum Terhubung:</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-300">
                  <li>Pastikan kabel USB tercolok ke Mac dan kamera dalam posisi <strong>ON</strong>.</li>
                  <li>Jika belum menginstal <code>gphoto2</code> di Mac, jalankan perintah: <code className="bg-black/60 px-1 py-0.5 rounded text-pink-300">brew install gphoto2</code> di terminal.</li>
                  <li>Atau pilih tombol <strong>Mock / Webcam Simulator</strong> di bawah untuk testing tanpa kamera fisik.</li>
                </ol>
              </div>
            )}

            <div className="mt-6">
              <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">
                Active Provider Mode:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setActiveProvider('mock');
                    onSetCameraProvider('mock');
                    setTimeout(fetchStatus, 500);
                  }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                    activeProvider === 'mock'
                      ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-500/25'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                  }`}
                >
                  Mock / Webcam Simulator
                </button>
                <button
                  onClick={() => {
                    setActiveProvider('gphoto2');
                    onSetCameraProvider('gphoto2');
                    setTimeout(fetchStatus, 500);
                  }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                    activeProvider === 'gphoto2'
                      ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-500/25'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                  }`}
                >
                  Canon 6D (gphoto2 macOS)
                </button>
              </div>
            </div>

            {/* Test Shot Button */}
            <div className="mt-4">
              <button
                onClick={async () => {
                  setTestShotResult('Memproses jepretan kamera...');
                  try {
                    const res = await fetch('/api/camera/test-shot', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      setTestShotResult(`✅ Jepretan berhasil! (${data.timeMs}ms)`);
                    } else {
                      setTestShotResult(`❌ Gagal: ${data.error}`);
                    }
                  } catch (err: any) {
                    setTestShotResult(`❌ Error koneksi: ${err.message}`);
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-pink-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>Jepret Uji Coba (Test Shot)</span>
              </button>
              {testShotResult && (
                <div className="mt-2.5 p-2 bg-gray-800 rounded-lg text-center">
                  <p className="text-xs font-semibold text-white">{testShotResult}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Printer Diagnostics Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Printer className="w-6 h-6 text-pink-400" />
              <h2 className="text-lg font-bold text-white">Silent Printer Settings</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Printer Target:</span>
                <span className="font-semibold text-white">{printerStatus?.name || 'Default Photo Printer'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Paper Remaining:</span>
                <span className="font-semibold text-green-400">
                  {printerStatus?.paperRemaining || 300} Lembar
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Mode Saat Ini:</span>
                <span className="font-semibold text-pink-400 uppercase">
                  {printerStatus?.mode || 'dry-run'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <span className="text-xs font-bold text-gray-300">Dry-Run Mode (Simulasi Cetak)</span>
                <input
                  type="checkbox"
                  checked={printerStatus?.mode === 'dry-run'}
                  onChange={(e) => onSetPrinterDryRun(e.target.checked)}
                  className="w-5 h-5 accent-pink-500 rounded"
                />
              </div>

              <button
                onClick={onTestPrint}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
              >
                Cetak Halaman Uji (Test Print)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
