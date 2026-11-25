import React, { useState, useEffect } from 'react';
import { QrCode, Sparkles, X, ShieldCheck, Clock, CheckCircle2, Tag } from 'lucide-react';
import { QrisTransaction } from '../../shared/types';

interface PaymentQrisScreenProps {
  transaction?: QrisTransaction;
  onCancel: () => void;
  onSimulatePaid?: () => void;
  onApplyVoucher: (code: string) => void;
}

export const PaymentQrisScreen: React.FC<PaymentQrisScreenProps> = ({
  transaction,
  onCancel,
  onSimulatePaid,
  onApplyVoucher,
}) => {
  const [timeLeft, setTimeLeft] = useState(300);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState(false);
  const [showVoucherInput, setShowVoucherInput] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    const calculateTime = () => {
      const remaining = Math.max(0, Math.floor((transaction.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        onCancel();
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [transaction, onCancel]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const formattedAmount = (transaction?.amount || 35000).toLocaleString('id-ID');

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    onApplyVoucher(voucherCode.trim());
    setVoucherError(true);
    setTimeout(() => setVoucherError(false), 2500);
  };

  return (
    <div className="relative w-full h-full bg-gray-950 flex flex-col p-8 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-pink-500" />
            Pembayaran QRIS Mandiri
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Buka aplikasi BCA Mobile, Livin, GoPay, OVO, ShopeePay, atau DANA untuk memindai QRIS di bawah.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-2xl font-bold transition-all active:scale-95 cursor-pointer"
        >
          <X className="w-5 h-5 text-gray-400" />
          <span>Batal</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center py-6">
        <div className="bg-gray-900 border-2 border-pink-500/40 rounded-3xl p-8 max-w-xl w-full shadow-[0_0_50px_rgba(244,63,94,0.15)] flex flex-col items-center">
          {/* Amount Badge */}
          <div className="flex items-center justify-between w-full mb-6 pb-4 border-b border-gray-800">
            <div>
              <span className="text-xs uppercase tracking-widest text-gray-400 font-bold">Total Pembayaran</span>
              <div className="text-3xl font-display font-black text-white mt-0.5">
                Rp {formattedAmount}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-pink-950/60 border border-pink-500/40 px-4 py-2 rounded-2xl text-pink-300 font-mono font-bold text-sm">
              <Clock className="w-4 h-4 text-pink-400 animate-spin" />
              <span>{timeFormatted}</span>
            </div>
          </div>

          {/* Dynamic QR Code Box */}
          <div className="relative p-4 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center mb-6">
            {transaction?.qrImageUrl ? (
              <img
                src={transaction.qrImageUrl}
                alt="QRIS Payment"
                className="w-64 h-64 object-contain rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 flex flex-col items-center justify-center text-gray-800 gap-3">
                <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Memuat Kode QRIS...</span>
              </div>
            )}

            <div className="mt-2 text-[11px] font-black tracking-widest text-gray-800 uppercase flex items-center gap-1.5">
              <span>QRIS Standar Pembayaran Nasional</span>
            </div>
          </div>

          {/* Supported Apps Banner */}
          <p className="text-xs text-gray-400 text-center mb-6">
            Mendukung semua m-Banking & e-Wallet: <strong className="text-gray-200">BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay</strong>
          </p>

          {/* Cash / Voucher Bypass Input Button */}
          {!showVoucherInput ? (
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setShowVoucherInput(true)}
                className="flex-1 py-3 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Tag className="w-4 h-4 text-pink-400" />
                <span>Punya Kode Voucher / Bayar Tunai?</span>
              </button>

              {/* Sandbox 1-Click Simulation Button for Dev / Operator Test */}
              {transaction?.provider === 'sandbox' && onSimulatePaid && (
                <button
                  onClick={onSimulatePaid}
                  className="py-3 px-4 bg-green-600/90 hover:bg-green-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-lg shadow-green-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simulasi Bayar (Dev)</span>
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleVoucherSubmit} className="flex gap-2 w-full">
              <input
                type="text"
                placeholder="Masukkan Kode Voucher / PIN Kasir"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-mono uppercase focus:outline-none focus:border-pink-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Klaim
              </button>
              <button
                type="button"
                onClick={() => setShowVoucherInput(false)}
                className="px-3 py-2.5 bg-gray-800 text-gray-400 hover:text-white rounded-xl text-xs"
              >
                Tutup
              </button>
            </form>
          )}

          {voucherError && (
            <p className="text-xs text-rose-400 font-semibold mt-2 animate-bounce">
              Kode voucher tidak valid atau sudah kedaluwarsa.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
