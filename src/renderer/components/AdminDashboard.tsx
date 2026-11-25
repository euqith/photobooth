import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Printer,
  RotateCcw,
  Check,
  Shield,
  CreditCard,
  Layers,
  DollarSign,
  Settings,
  Upload,
  Trash2,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Play,
  AlertTriangle,
} from 'lucide-react';
import {
  CameraStatus,
  PrinterStatus,
  ServerSettings,
  QrisTransaction,
  TemplateMetadata,
} from '../../shared/types';

interface AdminDashboardProps {
  onClose: () => void;
  onSetCameraProvider: (provider: 'mock' | 'gphoto2' | 'edsdk') => void;
  onSetPrinterDryRun: (dryRun: boolean) => void;
  onTestPrint: () => void;
  onTestShot?: () => void;
}

type AdminTab = 'payment' | 'templates' | 'transactions' | 'hardware';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  onSetCameraProvider,
  onSetPrinterDryRun,
  onTestPrint,
}) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('payment');

  // Hardware Status
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [activeProvider, setActiveProvider] = useState<'mock' | 'gphoto2'>('mock');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testShotResult, setTestShotResult] = useState<string | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraSwitchMessage, setCameraSwitchMessage] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);
  const [isTestingMidtrans, setIsTestingMidtrans] = useState(false);
  const [testMidtransResult, setTestMidtransResult] = useState<{ success: boolean; message: string; qrImageUrl?: string } | null>(null);

  // Voucher input temporary state
  const [newVoucherCode, setNewVoucherCode] = useState('');

  // Template Manager State
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templatePoseCount, setTemplatePoseCount] = useState(3);
  const [templateUploadMessage, setTemplateUploadMessage] = useState<string | null>(null);

  // Transactions State
  const [transactions, setTransactions] = useState<QrisTransaction[]>([]);
  const [transactionStats, setTransactionStats] = useState({
    totalTransactions: 0,
    paidCount: 0,
    totalGrossAmount: 0,
    voucherCount: 0,
  });

  const correctPin = '1234';

  const fetchStatus = () => {
    setIsRefreshing(true);
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.camera) {
          setCameraStatus(data.camera);
          if (data.camera.provider) {
            setActiveProvider(data.camera.provider);
          } else if (data.camera.model?.toLowerCase().includes('mock')) {
            setActiveProvider('mock');
          } else if (data.camera.model?.toLowerCase().includes('gphoto2') || data.camera.model?.toLowerCase().includes('canon')) {
            setActiveProvider('gphoto2');
          }
        }
        if (data.printer) setPrinterStatus(data.printer);
        if (data.settings) {
          setSettings((prev) => prev || data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  const fetchSettings = () => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        const s = data.settings || (data.payment ? data : null);
        if (s) {
          setSettings(s);
        }
      })
      .catch((err) => console.error('Gagal mengambil pengaturan:', err));
  };

  const fetchTemplates = () => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates(data.templates);
        }
      })
      .catch((err) => console.error('Gagal mengambil daftar template:', err));
  };

  const fetchTransactions = () => {
    fetch('/api/admin/transactions')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTransactions(data.transactions || []);
          if (data.stats) {
            setTransactionStats(data.stats);
          }
        }
      })
      .catch((err) => console.error('Gagal mengambil transaksi:', err));
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      fetchSettings();
      fetchTemplates();
      fetchTransactions();
    }
  }, [isAuthenticated]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setIsAuthenticated(true);
    } else {
      alert('PIN Salah!');
      setPin('');
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    setSettingsSavedMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSavedMessage('Pengaturan berhasil disimpan dan langsung aktif!');
        setTimeout(() => setSettingsSavedMessage(null), 3500);
      }
    } catch {
      alert('Gagal menyimpan pengaturan ke server.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddVoucher = () => {
    if (!newVoucherCode.trim() || !settings) return;
    const cleanCode = newVoucherCode.trim().toUpperCase();
    if (settings.payment.activeVouchers.includes(cleanCode)) return;

    setSettings({
      ...settings,
      payment: {
        ...settings.payment,
        activeVouchers: [...settings.payment.activeVouchers, cleanCode],
      },
    });
    setNewVoucherCode('');
  };

  const handleRemoveVoucher = (code: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      payment: {
        ...settings.payment,
        activeVouchers: settings.payment.activeVouchers.filter((v) => v !== code),
      },
    });
  };

  const handleUploadTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateFile) return;
    setIsUploadingTemplate(true);
    setTemplateUploadMessage(null);

    const formData = new FormData();
    formData.append('template', templateFile);
    formData.append('title', templateTitle || templateFile.name.replace(/\.[^/.]+$/, ''));
    formData.append('poseCount', String(templatePoseCount));

    try {
      const res = await fetch('/api/admin/templates/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setTemplateUploadMessage(`Template "${data.template.title}" berhasil diunggah & diproses!`);
        setTemplateFile(null);
        setTemplateTitle('');
        fetchTemplates();
      } else {
        alert(data.error || 'Gagal memproses template.');
      }
    } catch (err: any) {
      alert('Gagal mengunggah template: ' + err.message);
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  const handleToggleTemplate = async (id: string) => {
    try {
      await fetch(`/api/admin/templates/${id}/toggle`, { method: 'POST' });
      fetchTemplates();
    } catch (err: any) {
      alert('Gagal mengubah status template: ' + err.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Yakin ingin menghapus template ini?')) return;
    try {
      await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err: any) {
      alert('Gagal menghapus template: ' + err.message);
    }
  };

  const handleTestShotClick = () => {
    setTestShotResult('Mengambil foto...');
    fetch('/api/camera/test-shot', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTestShotResult(`Sukses! File: ${data.photoPath}`);
        } else {
          setTestShotResult(`Gagal: ${data.error}`);
        }
      })
      .catch((err) => setTestShotResult(`Error: ${err.message}`));
  };

  const handleSwitchCameraProvider = async (provider: 'mock' | 'gphoto2') => {
    setActiveProvider(provider);
    setIsSwitchingCamera(true);
    setCameraSwitchMessage(`Menghubungkan ke ${provider === 'gphoto2' ? 'Canon gphoto2' : 'Mock Camera'}...`);
    onSetCameraProvider(provider);

    try {
      const res = await fetch('/api/camera/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.health) {
        setCameraStatus(data.health);
        if (data.health.provider) {
          setActiveProvider(data.health.provider);
        }
        setCameraSwitchMessage(
          provider === 'gphoto2'
            ? data.health.connected
              ? 'Canon EOS 6D berhasil terhubung via gphoto2!'
              : 'Provider gphoto2 aktif. Kamera belum terdeteksi (pastikan kabel USB terhubung & kamera menyala).'
            : 'Mock Camera aktif (mode simulasi untuk development).'
        );
      }
    } catch (err: any) {
      setCameraSwitchMessage('Gagal mengubah provider kamera: ' + err.message);
    } finally {
      setIsSwitchingCamera(false);
      setTimeout(() => setCameraSwitchMessage(null), 5000);
    }
  };

  const handleSimulateWebhook = async () => {
    try {
      const res = await fetch('/api/admin/test-webhook', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Simulasi Webhook berhasil dikirim ke server!');
        fetchTransactions();
      } else {
        alert('Gagal kirim simulasi webhook: ' + data.error);
      }
    } catch (err: any) {
      alert('Error simulasi webhook: ' + err.message);
    }
  };

  const handleTestMidtrans = async () => {
    setIsTestingMidtrans(true);
    setTestMidtransResult(null);

    // Save current settings first so server uses the newest key
    if (settings) {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    }

    try {
      const res = await fetch('/api/admin/test-midtrans', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestMidtransResult({
          success: true,
          message: `${data.message} (Order ID: ${data.orderId})`,
          qrImageUrl: data.qrImageUrl,
        });
      } else {
        setTestMidtransResult({
          success: false,
          message: `Gagal: ${data.error}`,
        });
      }
    } catch (err: any) {
      setTestMidtransResult({
        success: false,
        message: `Error koneksi: ${err.message}`,
      });
    } finally {
      setIsTestingMidtrans(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-6">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
          <Shield className="w-14 h-14 text-pink-500 mb-3" />
          <h2 className="text-2xl font-bold text-white mb-2">Admin Control Center</h2>
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
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold text-sm cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-pink-500/20 cursor-pointer"
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-50 flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-gray-950 border border-gray-800/80 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-white">Photobooth Admin Center</h2>
              <p className="text-gray-400 text-xs">Self-Service QRIS Gateway & Kiosk Hardware Manager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-gray-900/50 border-b border-gray-800/80 flex gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('payment')}
            className={`py-3.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'payment'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Pembayaran & Webhook</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`py-3.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'templates'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Template Grid Manager</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-3.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Transaksi & Sesi</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`py-3.5 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'hardware'
                ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Hardware & Sistem</span>
          </button>
        </div>

        {/* Tab Body Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PEMBAYARAN & WEBHOOK */}
          {activeTab === 'payment' && (
            !settings ? (
              <div className="p-16 flex flex-col items-center justify-center text-gray-400">
                <div className="w-10 h-10 rounded-full border-4 border-pink-500 border-t-transparent animate-spin mb-4" />
                <p className="text-sm font-semibold">Memuat Pengaturan Pembayaran & Webhook...</p>
                <button
                  type="button"
                  onClick={fetchSettings}
                  className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-pink-400 text-xs font-bold rounded-xl border border-pink-500/30 cursor-pointer"
                >
                  Muat Ulang Pengaturan
                </button>
              </div>
            ) : (
            <div className="space-y-6">
              {settingsSavedMessage && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-semibold animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              {/* General Payment Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    Mode Pembayaran
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          payment: { ...settings.payment, mode: 'free' },
                        })
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        settings.payment.mode === 'free'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                          : 'bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      GRATIS (FREE)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          payment: { ...settings.payment, mode: 'paid' },
                        })
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        settings.payment.mode === 'paid'
                          ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                          : 'bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      BAYAR (PAID)
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    Payment Provider
                  </label>
                  <select
                    value={settings.payment.provider}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        payment: {
                          ...settings.payment,
                          provider: e.target.value as any,
                        },
                      })
                    }
                    className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-pink-500"
                  >
                    <option value="sandbox">Sandbox Simulator (Lokal Test)</option>
                    <option value="midtrans">Midtrans Core API</option>
                    <option value="xendit">Xendit QR Codes API</option>
                  </select>
                </div>

                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    Harga per Sesi (IDR)
                  </label>
                  <input
                    type="number"
                    value={settings.payment.sessionPrice}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        payment: {
                          ...settings.payment,
                          sessionPrice: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-bold font-mono focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Provider API Credentials */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-pink-400" />
                  <span>Kredensial API Gateway ({settings.payment.provider.toUpperCase()})</span>
                </h3>

                {settings.payment.provider === 'midtrans' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-gray-400 font-semibold block mb-1">Midtrans Server Key</label>
                      <input
                        type="password"
                        value={settings.payment.midtransServerKey}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: {
                              ...settings.payment,
                              midtransServerKey: e.target.value,
                            },
                          })
                        }
                        placeholder="SB-Mid-server-..."
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 font-semibold block mb-1">Midtrans Client Key</label>
                      <input
                        type="text"
                        value={settings.payment.midtransClientKey}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: {
                              ...settings.payment,
                              midtransClientKey: e.target.value,
                            },
                          })
                        }
                        placeholder="SB-Mid-client-..."
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 font-semibold block mb-1">Merchant ID</label>
                      <input
                        type="text"
                        value={settings.payment.midtransMerchantId}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: {
                              ...settings.payment,
                              midtransMerchantId: e.target.value,
                            },
                          })
                        }
                        placeholder="G123456789"
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="midtrans-environment"
                        checked={settings.payment.environment === 'production'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: {
                              ...settings.payment,
                              environment: e.target.checked ? 'production' : 'sandbox',
                            },
                          })
                        }
                        className="rounded accent-pink-500"
                      />
                      <label htmlFor="midtrans-environment" className="text-gray-300 font-bold">
                        Production Mode (Live)
                      </label>
                    </div>

                    <div className="md:col-span-2 pt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTestMidtrans}
                        disabled={isTestingMidtrans || !settings.payment.midtransServerKey}
                        className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-pink-400 rounded-xl font-bold text-xs flex items-center gap-2 border border-pink-500/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isTestingMidtrans ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        <span>Tes API Key Midtrans (Buat QRIS Uji Coba)</span>
                      </button>
                    </div>

                    {testMidtransResult && (
                      <div className={`md:col-span-2 p-3 rounded-xl border text-xs font-semibold animate-fade-in flex flex-col gap-2 ${
                        testMidtransResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}>
                        <div className="flex items-center gap-2">
                          {testMidtransResult.success ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                          )}
                          <span>{testMidtransResult.message}</span>
                        </div>
                        {testMidtransResult.qrImageUrl && (
                          <div className="mt-1 p-2 bg-white rounded-lg w-32 h-32 self-center flex items-center justify-center shadow-lg">
                            <img src={testMidtransResult.qrImageUrl} alt="QRIS Test" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {settings.payment.provider === 'xendit' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-gray-400 font-semibold block mb-1">Xendit Secret API Key</label>
                      <input
                        type="password"
                        value={settings.payment.xenditApiKey}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: {
                              ...settings.payment,
                              xenditApiKey: e.target.value,
                            },
                          })
                        }
                        placeholder="xnd_development_..."
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 font-semibold block mb-1">Webhook Secret / Verification Token</label>
                      <input
                        type="password"
                        value={settings.payment.webhookSecret}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: {
                              ...settings.payment,
                              webhookSecret: e.target.value,
                            },
                          })
                        }
                        placeholder="Verifikasi signature webhook"
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>
                )}

                {settings.payment.provider === 'sandbox' && (
                  <p className="text-xs text-amber-400 font-medium bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    Mode Sandbox aktif: QRIS dihasilkan secara lokal tanpa memerlukan akun payment gateway.
                    Tersedia tombol "Simulasikan Pembayaran Berhasil" di layar QRIS untuk pengujian instan.
                  </p>
                )}
              </div>

              {/* Hybrid Webhook & Cloud Relay Config */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-pink-400" />
                  <span>NAT Traversal & Polling Status Hybrid</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-gray-400 font-semibold block mb-1">
                      Metode Verifikasi
                    </label>
                    <select
                      value={settings.payment.verificationMethod}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          payment: {
                            ...settings.payment,
                            verificationMethod: e.target.value as any,
                          },
                        })
                      }
                      className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-pink-500"
                    >
                      <option value="polling">HTTP Polling Otomatis (Rekomendasi Tanpa NAT/VPS)</option>
                      <option value="relay">Cloud Relay Server (Webhook Teruskan ke WS)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 font-semibold block mb-1">
                      Interval Polling (ms)
                    </label>
                    <input
                      type="number"
                      step={500}
                      min={1000}
                      value={settings.payment.pollingIntervalMs}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          payment: {
                            ...settings.payment,
                            pollingIntervalMs: parseInt(e.target.value) || 2500,
                          },
                        })
                      }
                      className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-gray-400 font-semibold block mb-1">
                      Cloud Relay URL (Opsional jika menggunakan VPS / Cloudflare Tunnel)
                    </label>
                    <input
                      type="text"
                      value={settings.payment.cloudRelayUrl}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          payment: {
                            ...settings.payment,
                            cloudRelayUrl: e.target.value,
                          },
                        })
                      }
                      placeholder="https://relay.photobooth.domain/webhook/midtrans"
                      className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSimulateWebhook}
                    className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-pink-400 rounded-xl font-bold text-xs flex items-center gap-2 border border-pink-500/30 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Tes Kirim Webhook Lokal</span>
                  </button>
                </div>
              </div>

              {/* Webhook Configuration & URL Display Card */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-pink-400" />
                    <span>URL Webhook Callback Gateway</span>
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    AKTIF & SIAP MENERIMA
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Salin URL ini ke dashboard Midtrans (Settings → Configuration → Payment Notification URL) atau Xendit (Settings → Callbacks) agar notifikasi pembayaran langsung masuk ke photobooth:
                </p>
                <div className="p-3 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-pink-400 select-all font-semibold truncate">
                    {`http://${window.location.hostname || 'localhost'}:3000/api/payment/webhook`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`http://${window.location.hostname || 'localhost'}:3000/api/payment/webhook`);
                      alert('URL Webhook berhasil disalin!');
                    }}
                    className="py-1 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-lg text-xs font-bold border border-gray-700 shrink-0 transition-all cursor-pointer"
                  >
                    Salin URL
                  </button>
                </div>
              </div>

              {/* Voucher Management */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span>Manajemen Voucher Diskon / Bypass Kasir (100% Free Pass)</span>
                </h3>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="KODE VOUCHER (e.g. VIP2026)"
                    value={newVoucherCode}
                    onChange={(e) => setNewVoucherCode(e.target.value.toUpperCase())}
                    className="py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs font-mono font-bold uppercase focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddVoucher}
                    className="py-2 px-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Voucher</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {settings.payment.activeVouchers.map((code) => (
                    <div
                      key={code}
                      className="px-3 py-1.5 bg-gray-800/80 border border-gray-700/60 rounded-xl flex items-center gap-2"
                    >
                      <span className="font-mono font-black text-pink-400 text-xs tracking-wider">
                        {code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVoucher(code)}
                        className="text-gray-400 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Settings Action Bar */}
              <div className="sticky bottom-0 bg-gray-950/90 backdrop-blur-md p-4 border-t border-gray-800 flex justify-end gap-3 rounded-2xl">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="py-3 px-8 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl font-bold text-sm shadow-xl shadow-pink-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Simpan Perubahan Pengaturan</span>
                </button>
              </div>
            </div>
          ))}

          {/* TAB 2: TEMPLATE GRID MANAGER */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {templateUploadMessage && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-semibold animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{templateUploadMessage}</span>
                </div>
              )}

              {/* Upload New Template Form */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-pink-400" />
                  <span>Unggah Desain Template Baru (Otomatis Slot Detection)</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Format gambar: PNG 1333x1999 (4R 2-up Strip). Area lubang foto bisa berupa warna hijau Chroma-Key (#00FF00) atau transparan (Alpha 0). Sistem akan mendeteksi koordinat slot kiri & kanan secara otomatis.
                </p>

                <form onSubmit={handleUploadTemplate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">
                        Pilih File Template (.png)
                      </label>
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-gray-800 file:text-pink-400 hover:file:bg-gray-700 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">
                        Judul Template
                      </label>
                      <input
                        type="text"
                        value={templateTitle}
                        onChange={(e) => setTemplateTitle(e.target.value)}
                        placeholder="Contoh: Neon Vintage Strip"
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">
                        Jumlah Pose Foto
                      </label>
                      <select
                        value={templatePoseCount}
                        onChange={(e) => setTemplatePoseCount(parseInt(e.target.value) || 3)}
                        className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-pink-500"
                      >
                        <option value={3}>3 Pose (Standar Strip)</option>
                        <option value={4}>4 Pose (Mini Strip)</option>
                        <option value={2}>2 Pose (Wide)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUploadingTemplate || !templateFile}
                      className="py-2.5 px-6 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingTemplate ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>Proses & Simpan Template</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* List of Active Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-pink-400" />
                    <span>Daftar Template Aktif ({templates.length})</span>
                  </h3>
                  <button
                    onClick={fetchTemplates}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="group relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col p-2.5 hover:border-pink-500/50 transition-all"
                    >
                      <div className="aspect-[2/3] w-full bg-black/60 rounded-xl overflow-hidden relative flex items-center justify-center mb-2">
                        <img
                          src={tpl.processedImagePath || `/templates/${tpl.filename}`}
                          alt={tpl.title}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-pink-400">
                          {tpl.poseCount} Poses
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-black text-white truncate">{tpl.title}</h4>
                          <p className="text-[10px] text-gray-400">
                            Slot: {tpl.leftSlots?.length || 0} kiri / {tpl.rightSlots?.length || 0} kanan
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800">
                          <button
                            type="button"
                            onClick={() => handleToggleTemplate(tpl.id)}
                            className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                          >
                            Aktif
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSAKSI & SESI */}
          {activeTab === 'transactions' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Total Omzet (Settle)
                  </span>
                  <div className="text-2xl font-display font-black text-emerald-400 font-mono">
                    Rp {transactionStats.totalGrossAmount.toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Transaksi Sukses
                  </span>
                  <div className="text-2xl font-display font-black text-white font-mono">
                    {transactionStats.paidCount} Sesi
                  </div>
                </div>

                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Voucher / Kasir Bypass
                  </span>
                  <div className="text-2xl font-display font-black text-pink-400 font-mono">
                    {transactionStats.voucherCount} Penggunaan
                  </div>
                </div>

                <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Total Upaya Bayar
                  </span>
                  <div className="text-2xl font-display font-black text-gray-300 font-mono">
                    {transactionStats.totalTransactions}
                  </div>
                </div>
              </div>

              {/* Transactions Table & Export */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-pink-400" />
                    <span>Riwayat Transaksi QRIS Terakhir</span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={fetchTransactions}
                      className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <a
                      href="/api/admin/transactions?export=csv"
                      download="photobooth_transactions.csv"
                      className="py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-gray-700 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Ekspor CSV</span>
                    </a>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider font-bold">
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Sesi</th>
                        <th className="py-2.5 px-3">Nominal</th>
                        <th className="py-2.5 px-3">Metode</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-mono">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500 font-sans">
                            Belum ada transaksi tercatat.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.orderId} className="hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 px-3 text-white font-bold">{tx.orderId}</td>
                            <td className="py-2.5 px-3 text-gray-400">{tx.sessionId}</td>
                            <td className="py-2.5 px-3 text-white">
                              Rp {tx.amount.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 uppercase text-[10px] text-pink-400 font-sans font-bold">
                              {tx.provider}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {tx.status === 'PAID' ? (
                                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  SETTLED
                                </span>
                              ) : tx.status === 'PENDING' ? (
                                <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  PENDING
                                </span>
                              ) : (
                                <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  {tx.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HARDWARE & SISTEM */}
          {activeTab === 'hardware' && (
            <div className="space-y-6">
              {/* Camera Section */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-pink-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Kamera DSLR Canon</h3>
                      <p className="text-xs text-gray-400">
                        {cameraStatus?.model || 'Memeriksa perangkat...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        cameraStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-gray-300">
                      {cameraStatus?.connected ? 'TERHUBUNG' : 'TERPUTUS'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleSwitchCameraProvider('mock')}
                    disabled={isSwitchingCamera}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      activeProvider === 'mock'
                        ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {isSwitchingCamera && activeProvider === 'mock' && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>Gunakan Mock Camera</span>
                  </button>
                  <button
                    onClick={() => handleSwitchCameraProvider('gphoto2')}
                    disabled={isSwitchingCamera}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      activeProvider === 'gphoto2'
                        ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {isSwitchingCamera && activeProvider === 'gphoto2' && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>Gunakan Canon gphoto2</span>
                  </button>
                </div>

                {cameraSwitchMessage && (
                  <div className="p-3 bg-pink-500/10 border border-pink-500/30 rounded-xl text-pink-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-pink-400" />
                    <span>{cameraSwitchMessage}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleTestShotClick}
                    className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-pink-400" />
                    <span>Ambil Test Shot</span>
                  </button>
                  {testShotResult && (
                    <span className="text-xs text-gray-400 self-center font-mono">
                      {testShotResult}
                    </span>
                  )}
                </div>
              </div>

              {/* Printer Section */}
              <div className="p-5 bg-gray-900 border border-gray-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Printer className="w-5 h-5 text-pink-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Printer Photo Kiosk</h3>
                      <p className="text-xs text-gray-400">
                        {printerStatus?.name || 'Canon Selphy / DNP QW410'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        printerStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-xs font-bold text-gray-300">
                      {printerStatus?.connected ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-800/80 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-white block">Mode Dry-Run (Simulasi)</span>
                    <span className="text-[11px] text-gray-400">
                      Jangan buang kertas foto asli saat testing
                    </span>
                  </div>
                  <button
                    onClick={() => onSetPrinterDryRun(printerStatus?.mode !== 'dry-run')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      printerStatus?.mode === 'dry-run'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {printerStatus?.mode === 'dry-run' ? 'DRY RUN AKTIF' : 'NORMAL PRINT'}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onTestPrint}
                    className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-pink-400" />
                    <span>Kirim Test Print Page</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
