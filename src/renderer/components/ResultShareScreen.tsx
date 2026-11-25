import React, { useState, useEffect } from 'react';
import { Printer, QrCode, Sparkles, Check, Home, Plus, Minus } from 'lucide-react';
import { ColorFilter } from '../../shared/types';

interface ResultShareScreenProps {
  sessionId: string;
  templateId: string;
  activeFilter: ColorFilter;
  onApplyFilter: (filter: ColorFilter) => void;
  onPrint: (copies: number) => void;
  onDone: () => void;
}

export const ResultShareScreen: React.FC<ResultShareScreenProps> = ({
  sessionId,
  templateId,
  activeFilter,
  onApplyFilter,
  onPrint,
  onDone,
}) => {
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [qrCodeDataUri, setQrCodeDataUri] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [autoDoneSeconds, setAutoDoneSeconds] = useState(60);

  // Auto return to home
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoDoneSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone]);

  // Fetch QR Code data for mobile sharing
  useEffect(() => {
    fetch(`/api/qr/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.qrDataUri) {
          setQrCodeDataUri(data.qrDataUri);
          setQrUrl(data.url);
        }
      })
      .catch((err) => console.error('Error fetching QR:', err));
  }, [sessionId]);

  const handlePrint = () => {
    setIsPrinting(true);
    onPrint(copies);
    setTimeout(() => {
      setIsPrinting(false);
      setPrintSuccess(true);
    }, 2500);
  };

  const printImageUrl = `/output/sessions/${sessionId}/print_4x6_2up.jpg?t=${Date.now()}`;

  const filters: { id: ColorFilter; label: string }[] = [
    { id: 'original', label: 'Original' },
    { id: 'bw', label: 'B & W' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'bright', label: 'Bright' },
  ];

  return (
    <div className="relative w-full h-full bg-gray-950 flex flex-col p-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-pink-500" />
          <h1 className="text-3xl font-display font-extrabold text-white">
            Hasil Foto Kamu Siap!
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm font-mono text-gray-400">
            Kembali ke awal: <span className="text-pink-400 font-bold">{autoDoneSeconds}s</span>
          </div>
          <button
            onClick={onDone}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-semibold transition-all active:scale-95"
          >
            <Home className="w-5 h-5 text-pink-400" />
            <span>Selesai</span>
          </button>
        </div>
      </div>

      {/* Main Content Split: Left Image Preview, Right Print & QR Panel */}
      <div className="flex-1 grid grid-cols-12 gap-8 py-6 overflow-hidden">
        {/* Left: Collage Image Preview (7 cols) */}
        <div className="col-span-7 bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col items-center justify-between shadow-2xl">
          <div className="w-full flex justify-center flex-1 max-h-[62vh]">
            <img
              src={printImageUrl}
              alt="Final Collage"
              className="h-full max-w-full object-contain rounded-2xl shadow-2xl border-2 border-gray-700"
            />
          </div>

          {/* Color Filter Selector Bar */}
          <div className="flex items-center gap-3 pt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mr-2">Filter:</span>
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => onApplyFilter(f.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeFilter === f.id
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-pink-500/25'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Print & QR Digital Download (5 cols) */}
        <div className="col-span-5 flex flex-col gap-6 justify-between">
          {/* Silent Print Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Printer className="w-6 h-6 text-pink-400" />
                <h2 className="text-xl font-bold text-white">Cetak Foto Fisik</h2>
              </div>
              <p className="text-gray-400 text-sm">
                Cetak foto strip instan tanpa antri (1 lembar = 2 strip potong).
              </p>
            </div>

            {/* Copies Counter */}
            <div className="flex items-center justify-between bg-gray-800/80 px-4 py-3 rounded-2xl my-4">
              <span className="text-sm font-semibold text-gray-300">Jumlah Cetak</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                  className="w-9 h-9 rounded-xl bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-bold font-mono text-white px-2">{copies}</span>
                <button
                  onClick={() => setCopies((prev) => Math.min(2, prev + 1))}
                  className="w-9 h-9 rounded-xl bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Print Trigger Button */}
            <button
              onClick={handlePrint}
              disabled={isPrinting || printSuccess}
              className={`w-full py-4 rounded-2xl font-display font-bold text-xl text-white shadow-xl flex items-center justify-center gap-3 transition-all ${
                printSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-pink-500/25 active:scale-95'
              }`}
            >
              {printSuccess ? (
                <>
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>Sedang Dicetak!</span>
                </>
              ) : isPrinting ? (
                <span>Mengirim ke Printer...</span>
              ) : (
                <>
                  <Printer className="w-6 h-6" />
                  <span>Cetak {copies} Lembar</span>
                </>
              )}
            </button>
          </div>

          {/* QR Code Digital Download Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-2xl flex-1">
            <div className="flex items-center gap-2 mb-2 text-pink-400">
              <QrCode className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Unduh Digital</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Scan QR di Ponselmu</h3>

            {qrCodeDataUri ? (
              <div className="p-3 bg-white rounded-2xl shadow-2xl border border-gray-700">
                <img src={qrCodeDataUri} alt="QR Code" className="w-40 h-40 object-contain" />
              </div>
            ) : (
              <div className="w-40 h-40 bg-gray-800 rounded-2xl animate-pulse flex items-center justify-center text-xs text-gray-500">
                Membuat QR...
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3 font-mono truncate max-w-xs">{qrUrl}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
