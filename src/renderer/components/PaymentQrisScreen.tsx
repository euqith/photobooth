import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Sparkles,
  X,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Tag,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Info,
} from 'lucide-react';
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
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

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

  const formattedAmount = (transaction?.amount || 50000).toLocaleString('id-ID');
  const orderDate = new Date(transaction?.expiresAt ? transaction.expiresAt - 5 * 60 * 1000 : Date.now());
  const formattedDate = orderDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopyOrderId = () => {
    if (!transaction?.orderId) return;
    navigator.clipboard.writeText(transaction.orderId);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    onApplyVoucher(voucherCode.trim());
    setVoucherError(true);
    setTimeout(() => setVoucherError(false), 2500);
  };

  const handleAutoSimulateMidtrans = async () => {
    if (!transaction?.qrCodeUrl) return;
    setIsSimulating(true);
    try {
      const apiUrl =
        window.location.port === '5173'
          ? 'http://localhost:4000/api/payment/simulate-midtrans-pay'
          : '/api/payment/simulate-midtrans-pay';

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeUrl: transaction.qrCodeUrl }),
      });
      const data = await res.json();
      if (data.success) {
        // Successful simulation, polling will automatically settle
      } else {
        alert('Gagal simulasi: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Error simulasi: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#080B11] flex flex-col p-6 lg:p-10 overflow-hidden select-none font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-5 border-b border-gray-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-black text-white tracking-wide">
              Pembayaran QRIS Mandiri
            </h1>
            <p className="text-gray-400 text-xs lg:text-sm">
              Scan kode QR menggunakan m-Banking atau e-Wallet apapun yang mendukung QRIS nasional
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-gray-300 border border-gray-700/60 rounded-2xl font-bold text-sm transition-all active:scale-95 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Batal</span>
        </button>
      </div>

      {/* Main 2-Column Container */}
      <div className="flex-1 flex items-center justify-center py-4 overflow-y-auto">
        <div className="bg-[#0F1422] border border-gray-800/80 rounded-3xl p-6 lg:p-8 max-w-5xl w-full shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* ================= LEFT COLUMN: ORDER DETAILS ================= */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-5">
            {/* Order Info Card (Styled like Invoice Reference) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-xl text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                  <span>Detail Tagihan</span>
                </span>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 font-mono font-bold text-xs">
                  <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                  <span>Sisa Waktu: {timeFormatted}</span>
                </div>
              </div>

              {/* Order Meta Rows */}
              <div className="bg-[#151D30] border border-gray-800/80 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800/60">
                  <span className="text-gray-400 font-semibold">No. Pesanan</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-white font-bold">{transaction?.orderId || 'PB-XXXXXX'}</span>
                    <button
                      type="button"
                      onClick={handleCopyOrderId}
                      className="p-1 hover:bg-gray-700/60 rounded text-gray-400 hover:text-white transition-all cursor-pointer"
                      title="Salin No. Pesanan"
                    >
                      {copiedOrderId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-gray-800/60">
                  <span className="text-gray-400 font-semibold">Waktu Pemesanan</span>
                  <span className="text-gray-200 font-medium">{formattedDate}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-gray-800/60">
                  <span className="text-gray-400 font-semibold">Paket Sesi</span>
                  <span className="text-gray-200 font-medium">1x Sesi Foto + Cetak 2 Strip (4x6)</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-semibold">Metode Pembayaran</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider">QRIS Dinamis</span>
                </div>
              </div>

              {/* Amount Highlight Box */}
              <div className="p-4 bg-gradient-to-r from-pink-950/40 to-[#151D30] border border-pink-500/30 rounded-2xl flex flex-col justify-center">
                <span className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">
                  Jumlah yang Harus Dibayar
                </span>
                <div className="text-3xl lg:text-4xl font-display font-black text-white mt-1">
                  Rp {formattedAmount}
                </div>
                <span className="text-[11px] text-pink-300/80 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  Pastikan membayar sesuai nominal tertera
                </span>
              </div>
            </div>

            {/* Voucher & Sandbox Actions */}
            <div className="space-y-3 pt-1">
              {!showVoucherInput ? (
                <button
                  type="button"
                  onClick={() => setShowVoucherInput(true)}
                  className="w-full py-2.5 px-4 bg-[#151D30] hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/60 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-pink-400" />
                  <span>Punya Kode Voucher / Bayar Kasir Tunai?</span>
                </button>
              ) : (
                <form onSubmit={handleVoucherSubmit} className="flex gap-2 w-full animate-fade-in">
                  <input
                    type="text"
                    placeholder="Masukkan Kode Voucher / PIN"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    autoFocus
                    className="flex-1 px-4 py-2 bg-[#151D30] border border-gray-700 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Klaim
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVoucherInput(false)}
                    className="px-3 py-2 bg-gray-800 text-gray-400 hover:text-white rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </form>
              )}

              {voucherError && (
                <p className="text-xs text-rose-400 font-semibold animate-bounce text-center">
                  Kode voucher tidak valid atau sudah kedaluwarsa.
                </p>
              )}

              {/* Dev/Test Simulator Buttons (Midtrans & Sandbox) */}
              {transaction?.provider === 'sandbox' && onSimulatePaid && (
                <button
                  type="button"
                  onClick={onSimulatePaid}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>⚡ Simulasi Bayar Sukses (Sandbox Mock)</span>
                </button>
              )}

              {transaction?.provider === 'midtrans' && (
                <div className="p-3 bg-[#151D30]/80 border border-gray-800 rounded-2xl space-y-2">
                  <button
                    type="button"
                    onClick={handleAutoSimulateMidtrans}
                    disabled={isSimulating}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95"
                  >
                    {isSimulating ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>⚡ Simulasi Bayar Sukses (Midtrans Test)</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const toCopy = transaction.qrCodeUrl || transaction.qrString || '';
                        navigator.clipboard.writeText(toCopy);
                        alert('✅ URL QRIS disalin! Tempel di kotak "QR Code Image Url" pada Simulator.');
                      }}
                      className="flex-1 py-1.5 px-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-pink-400" />
                      <span>Salin URL QR</span>
                    </button>
                    <a
                      href="https://simulator.sandbox.midtrans.com/v2/qris/index"
                      target="_blank"
                      rel="noreferrer"
                      className="py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                    >
                      <span>Simulator ↗</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: QR CODE DISPLAY ================= */}
          <div className="md:col-span-6 flex flex-col items-center justify-center">
            {/* White Official QRIS Card */}
            <div className="bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-center border-4 border-gray-100 max-w-sm w-full">
              {/* QRIS Header Logo */}
              <div className="w-full flex items-center justify-between pb-3 border-b-2 border-gray-200 mb-3 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="bg-black text-white px-2 py-0.5 rounded font-black text-xs tracking-wider">
                    QRIS
                  </div>
                  <span className="text-[10px] font-black tracking-tight text-gray-800 uppercase">
                    Pembayaran Nasional
                  </span>
                </div>
                <div className="text-[9px] font-mono text-gray-600 font-bold">
                  ASPI / BI
                </div>
              </div>

              {/* Crisp High-Res QR Code Image with Clear Quiet Zone */}
              <div className="w-64 h-64 lg:w-72 lg:h-72 flex items-center justify-center bg-white p-2">
                {transaction?.qrImageUrl ? (
                  <img
                    src={transaction.qrImageUrl}
                    alt="Kode QRIS Photobooth"
                    className="w-full h-full object-contain select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-800 gap-3">
                    <div className="w-10 h-10 border-4 border-pink-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold">Menyiapkan QRIS Resmi...</span>
                  </div>
                )}
              </div>

              {/* Footer Indicator on White Card */}
              <div className="w-full pt-3 mt-1 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-600 font-mono font-semibold px-1">
                <span>NMID: {transaction?.provider === 'midtrans' ? 'ID1020039450309' : 'ID0000000000000'}</span>
                <span className="text-pink-600 font-bold">VERIFIKASI OTOMATIS</span>
              </div>
            </div>

            {/* Supported Banks & E-Wallets Tags */}
            <div className="mt-4 text-center max-w-sm w-full">
              <p className="text-[11px] text-gray-400 font-medium mb-2">
                Dapat discan dengan kamera aplikasi:
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 text-[10px] font-bold text-gray-300">
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">BCA Mobile</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">Livin' Mandiri</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">BRImo</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">BNI Mobile</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">GoPay</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">OVO</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">DANA</span>
                <span className="px-2.5 py-1 bg-[#151D30] border border-gray-800 rounded-lg">ShopeePay</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
