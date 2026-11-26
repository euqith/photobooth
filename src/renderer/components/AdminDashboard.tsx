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
  LayoutDashboard,
  Cpu,
  Copy,
  ExternalLink,
  Search,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  CheckCircle,
  Smartphone,
  Images,
  Film,
  Sun,
  Moon,
} from 'lucide-react';
import {
  CameraStatus,
  PrinterStatus,
  ServerSettings,
  QrisTransaction,
  TemplateMetadata,
  PhotoHistorySession,
} from '../../shared/types';

interface AdminDashboardProps {
  onClose: () => void;
  onSetCameraProvider: (provider: 'mock' | 'gphoto2' | 'edsdk') => void;
  onSetPrinterDryRun: (dryRun: boolean) => void;
  onTestPrint: () => void;
  onTestShot?: () => void;
  isStandalone?: boolean;
}

type AdminTab = 'overview' | 'payment' | 'templates' | 'transactions' | 'gallery' | 'hardware';

const DEFAULT_SETTINGS: ServerSettings = {
  countdownDuration: 5,
  reviewDuration: 3,
  allowRetake: true,
  maxRetakesPerPose: 1,
  maxPrintCopies: 2,
  autoPrint: false,
  adminPin: '1234',
  printerName: 'Default_Photo_Printer',
  dryRunPrinter: true,
  cameraProvider: 'gphoto2',
  payment: {
    mode: 'paid',
    provider: 'midtrans',
    environment: 'sandbox',
    sessionPrice: 50000,
    extraPrintPrice: 10000,
    qrisTimeoutSeconds: 300,
    verificationMethod: 'polling',
    pollingIntervalMs: 2500,
    midtransServerKey: '',
    midtransClientKey: '',
    midtransMerchantId: '',
    xenditApiKey: '',
    cloudRelayUrl: '',
    webhookSecret: '',
    activeVouchers: ['VIPGUEST', 'CASH01', 'PROMO2026'],
  },
};

const getApiUrl = (endpoint: string) => {
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `http://localhost:4000${endpoint}`;
  }
  return endpoint;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  onSetCameraProvider,
  onSetPrinterDryRun,
  onTestPrint,
  isStandalone = false,
}) => {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [networkInfo, setNetworkInfo] = useState<{ localIp: string; adminUrl: string; kioskUrl: string } | null>(null);
  const [copiedAdminUrl, setCopiedAdminUrl] = useState(false);

  // Day Mode / Dark Mode Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('photobooth_admin_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const toggleTheme = (newTheme?: 'dark' | 'light') => {
    const next = newTheme || (theme === 'dark' ? 'light' : 'dark');
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('photobooth_admin_theme', next);
    }
  };

  // Hardware Status
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [activeProvider, setActiveProvider] = useState<'mock' | 'gphoto2'>('mock');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testShotResult, setTestShotResult] = useState<string | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [cameraSwitchMessage, setCameraSwitchMessage] = useState<string | null>(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [testPrintResult, setTestPrintResult] = useState<{ success: boolean; message: string } | null>(null);

  // Settings State
  const [settings, setSettings] = useState<ServerSettings>(DEFAULT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);
  const [isTestingMidtrans, setIsTestingMidtrans] = useState(false);
  const [testMidtransResult, setTestMidtransResult] = useState<{
    success: boolean;
    message: string;
    orderId?: string;
    amount?: number;
    qrImageUrl?: string;
    qrString?: string;
    qrCodeUrl?: string;
  } | null>(null);
  const [showServerKey, setShowServerKey] = useState(false);

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
  const [txSearch, setTxSearch] = useState('');
  const [txFilterStatus, setTxFilterStatus] = useState<'ALL' | 'PAID' | 'PENDING' | 'VOUCHER' | 'CANCELLED'>('ALL');
  const [transactionStats, setTransactionStats] = useState({
    totalTransactions: 0,
    paidCount: 0,
    totalGrossAmount: 0,
    voucherCount: 0,
  });

  // Photo History Gallery State
  const [photoSessions, setPhotoSessions] = useState<PhotoHistorySession[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photoSearch, setPhotoSearch] = useState('');
  const [photoFilter, setPhotoFilter] = useState<'ALL' | 'PRINT' | 'BOOMERANG'>('ALL');
  const [selectedSession, setSelectedSession] = useState<PhotoHistorySession | null>(null);
  const [selectedMediaMode, setSelectedMediaMode] = useState<'print' | 'strip' | 'poses' | 'boomerang'>('print');
  const [isReprinting, setIsReprinting] = useState(false);
  const [reprintMessage, setReprintMessage] = useState<string | null>(null);

  // Current Clock
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('id-ID'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const correctPin = '1234';

  const fetchStatus = () => {
    setIsRefreshing(true);
    fetch(getApiUrl('/api/health'))
      .then((res) => res.json())
      .then((data) => {
        if (data.camera) {
          setCameraStatus(data.camera);
          if (data.camera.provider) {
            setActiveProvider(data.camera.provider);
          } else if (data.camera.model?.toLowerCase().includes('mock')) {
            setActiveProvider('mock');
          } else if (
            data.camera.model?.toLowerCase().includes('gphoto2') ||
            data.camera.model?.toLowerCase().includes('canon')
          ) {
            setActiveProvider('gphoto2');
          }
        }
        if (data.printer) setPrinterStatus(data.printer);
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch((err) => console.error('Failed to fetch health status:', err))
      .finally(() => setIsRefreshing(false));

    fetch(getApiUrl('/api/network-info'))
      .then((res) => res.json())
      .then((data) => setNetworkInfo(data))
      .catch(() => {});
  };

  const fetchSettings = () => {
    fetch(getApiUrl('/api/admin/settings'))
      .then((res) => res.json())
      .then((data) => {
        const s = data.settings || (data.payment ? data : null);
        if (s) {
          setSettings(s);
          if (s.cameraProvider) {
            setActiveProvider(s.cameraProvider);
          }
        }
      })
      .catch((err) => console.error('Gagal mengambil pengaturan:', err));
  };

  const fetchTemplates = () => {
    fetch(getApiUrl('/api/templates'))
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates(data.templates);
        }
      })
      .catch((err) => console.error('Gagal mengambil daftar template:', err));
  };

  const fetchTransactions = () => {
    fetch(getApiUrl('/api/admin/transactions'))
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTransactions(data.transactions || []);
          if (data.stats) {
            setTransactionStats({
              totalTransactions: data.stats.totalTransactions ?? (data.transactions?.length || 0),
              paidCount: data.stats.paidCount ?? data.stats.count ?? 0,
              totalGrossAmount: data.stats.totalGrossAmount ?? data.stats.totalAmount ?? 0,
              voucherCount: data.stats.voucherCount ?? 0,
            });
          }
        }
      })
      .catch((err) => console.error('Gagal mengambil transaksi:', err));
  };

  const fetchPhotoHistory = () => {
    setIsLoadingPhotos(true);
    fetch(getApiUrl('/api/admin/photo-history'))
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.sessions)) {
          setPhotoSessions(data.sessions);
        }
      })
      .catch((err) => console.error('Gagal mengambil histori foto:', err))
      .finally(() => setIsLoadingPhotos(false));
  };

  const handleReprintSession = async (sessionId: string) => {
    setIsReprinting(true);
    setReprintMessage(null);
    try {
      const res = await fetch(getApiUrl(`/api/admin/reprint/${sessionId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copies: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        setReprintMessage(`Berhasil mengirim perintah cetak untuk sesi ${sessionId}`);
      } else {
        setReprintMessage(`Gagal cetak: ${data.message || 'Error printer'}`);
      }
    } catch (err: any) {
      setReprintMessage(`Error: ${err?.message || 'Gagal koneksi'}`);
    } finally {
      setIsReprinting(false);
      setTimeout(() => setReprintMessage(null), 5000);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
      fetchSettings();
      fetchTemplates();
      fetchTransactions();
      fetchPhotoHistory();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'gallery') {
      fetchPhotoHistory();
    }
  }, [activeTab, isAuthenticated]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setIsAuthenticated(true);
    } else {
      alert('PIN Salah! Masukkan PIN operator yang benar.');
      setPin('');
    }
  };

  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    setTestPrintResult(null);
    try {
      onTestPrint(); // socket trigger
      const res = await fetch(getApiUrl('/api/admin/test-print'), {
        method: 'POST',
      });
      const data = await res.json();
      setTestPrintResult(data);
    } catch (err: any) {
      setTestPrintResult({ success: false, message: `Error: ${err?.message || 'Gagal koneksi'}` });
    } finally {
      setIsTestingPrint(false);
      setTimeout(() => setTestPrintResult(null), 8000);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    setSettingsSavedMessage(null);
    try {
      const res = await fetch(getApiUrl('/api/admin/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSavedMessage('Pengaturan berhasil disimpan ke server!');
        setTimeout(() => setSettingsSavedMessage(null), 4000);
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
      const res = await fetch(getApiUrl('/api/admin/templates/upload'), {
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
      await fetch(getApiUrl(`/api/admin/templates/${id}/toggle`), { method: 'POST' });
      fetchTemplates();
    } catch (err) {
      console.error('Gagal toggle template:', err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Yakin ingin menghapus template ini?')) return;
    try {
      await fetch(getApiUrl(`/api/admin/templates/${id}`), { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      console.error('Gagal hapus template:', err);
    }
  };

  const handleTriggerTestShot = () => {
    setTestShotResult('Mengambil foto...');
    fetch(getApiUrl('/api/camera/test-shot'), { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTestShotResult(`Sukses! File tersimpan: ${data.photoPath}`);
        } else {
          setTestShotResult(`Gagal: ${data.error}`);
        }
      })
      .catch((err) => setTestShotResult(`Error: ${err.message}`));
  };

  const handleSwitchCameraProvider = async (provider: 'mock' | 'gphoto2') => {
    setActiveProvider(provider);
    setIsSwitchingCamera(true);
    setCameraSwitchMessage(
      `Sedang beralih ke ${provider === 'gphoto2' ? 'Canon gphoto2' : 'Mock Camera'}...`
    );
    onSetCameraProvider(provider);

    try {
      const res = await fetch(getApiUrl('/api/camera/provider'), {
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
              ? '✅ Kamera Canon EOS 6D berhasil terhubung via gphoto2!'
              : '⚠️ Provider gphoto2 aktif. Kamera belum terdeteksi di port USB (pastikan kamera ON).'
            : '✅ Mock Camera aktif (simulasi development).'
        );
      }
    } catch (err: any) {
      setCameraSwitchMessage('⚠️ Gagal mengubah provider kamera: ' + err.message);
    } finally {
      setIsSwitchingCamera(false);
      setTimeout(() => setCameraSwitchMessage(null), 5000);
    }
  };

  const handleSimulateWebhook = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/test-webhook'), { method: 'POST' });
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
      await fetch(getApiUrl('/api/admin/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/test-midtrans'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestMidtransResult({
          success: true,
          message: data.message,
          orderId: data.orderId,
          amount: data.amount,
          qrImageUrl: data.qrImageUrl,
          qrString: data.qrString,
          qrCodeUrl: data.qrCodeUrl,
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

  const filteredTransactions = transactions.filter((t) => {
    if (txFilterStatus !== 'ALL' && t.status !== txFilterStatus) return false;
    if (txSearch) {
      const q = txSearch.toLowerCase();
      return (
        t.orderId.toLowerCase().includes(q) ||
        t.sessionId.toLowerCase().includes(q) ||
        (t.amount || 0).toString().includes(q)
      );
    }
    return true;
  });

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:4000/api/payment/webhook`;

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-50 flex items-center justify-center p-6 animate-fade-in">
        <div className="bg-[#0D121F] border border-gray-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-400 p-0.5 mb-4 shadow-lg shadow-pink-500/20">
            <div className="w-full h-full bg-[#090D16] rounded-2xl flex items-center justify-center text-pink-400">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Photobooth OS</h2>
          <p className="text-gray-400 text-xs mb-6 text-center">
            Admin & Kiosk Control Center (Default PIN: 1234)
          </p>

          <form onSubmit={handlePinSubmit} className="w-full flex flex-col gap-4">
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoFocus
              className="w-full text-center text-3xl tracking-widest py-3 bg-[#161F30] border border-gray-700/80 rounded-2xl text-white font-mono focus:outline-none focus:border-pink-500 shadow-inner"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold text-sm cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-pink-500/25 cursor-pointer transition-all"
              >
                Buka Panel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 animate-fade-in font-sans ${
        theme === 'light'
          ? 'admin-day-mode bg-slate-900/35 backdrop-blur-xl'
          : 'admin-dark-mode bg-black/85 backdrop-blur-xl'
      }`}
    >
      <div className="bg-[#090D16] border border-gray-800/80 rounded-3xl w-full max-w-7xl h-[94vh] flex shadow-2xl overflow-hidden">
        {/* ================= LEFT SIDEBAR ================= */}
        <div className="w-64 bg-[#0D121F] border-r border-gray-800/80 flex flex-col justify-between p-4 shrink-0">
          <div>
            {/* Branding Header */}
            <div className="flex items-center gap-3 px-3 py-3 mb-6 bg-[#161F30]/60 rounded-2xl border border-gray-800/80">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-sm font-display font-black tracking-wider text-white uppercase truncate">
                  PHOTOBOOTH OS
                </h1>
                <p className="text-[11px] text-pink-400 font-mono font-semibold">Admin Center v2.0</p>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1.5">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-pink-600/90 to-rose-600/90 text-white shadow-lg shadow-pink-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Ringkasan Kiosk</span>
              </button>

              <button
                onClick={() => setActiveTab('payment')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'payment'
                    ? 'bg-gradient-to-r from-pink-600/90 to-rose-600/90 text-white shadow-lg shadow-pink-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Pembayaran & Webhook</span>
              </button>

              <button
                onClick={() => setActiveTab('templates')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'templates'
                    ? 'bg-gradient-to-r from-pink-600/90 to-rose-600/90 text-white shadow-lg shadow-pink-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Template Grid Manager</span>
              </button>

              <button
                onClick={() => setActiveTab('transactions')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'transactions'
                    ? 'bg-gradient-to-r from-pink-600/90 to-rose-600/90 text-white shadow-lg shadow-pink-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                <span>Transaksi & Sesi</span>
              </button>

              <button
                onClick={() => setActiveTab('gallery')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'bg-gradient-to-r from-pink-600/90 to-rose-600/90 text-white shadow-lg shadow-pink-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Images className="w-4 h-4 shrink-0" />
                  <span>Log Histori Foto</span>
                </div>
                {photoSessions.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] bg-pink-500/20 text-pink-300 font-mono rounded-full border border-pink-500/30">
                    {photoSessions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('hardware')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'hardware'
                    ? 'bg-gradient-to-r from-pink-600/90 to-rose-600/90 text-white shadow-lg shadow-pink-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0" />
                <span>Hardware & Diagnostik</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-gray-800/80 space-y-3">
            <div className="px-3 py-2 bg-[#161F30]/40 rounded-xl border border-gray-800/50 flex items-center justify-between text-[11px]">
              <span className="text-gray-400">Operator:</span>
              <span className="text-pink-400 font-bold">Admin (Kiosk Owner)</span>
            </div>

            <div className="px-3 py-2 bg-[#161F30]/40 rounded-xl border border-gray-800/50 flex items-center justify-between text-[11px]">
              <span className="text-gray-400">Tema Admin:</span>
              <button
                type="button"
                onClick={() => toggleTheme()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161F30] hover:bg-pink-600 hover:text-white text-pink-400 border border-gray-700/60 font-bold transition-all cursor-pointer"
                title="Ganti Tema Dark Mode / Day Mode"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="w-3 h-3" />
                    <span>Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3 h-3 text-amber-500" />
                    <span>Day Mode</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-3 bg-gray-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-gray-300 border border-gray-700/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{isStandalone ? 'Kembali ke Photobooth Kiosk' : 'Keluar / Tutup Admin'}</span>
            </button>
          </div>
        </div>

        {/* ================= RIGHT MAIN CONTENT AREA ================= */}
        <div className="flex-1 flex flex-col bg-[#0B0F19] overflow-hidden">
          {/* Top Bar */}
          <header className="px-6 py-4 bg-[#0D121F]/90 border-b border-gray-800/80 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-display font-black text-white flex items-center gap-2">
                {activeTab === 'overview' && 'Ringkasan & Telemetri Kiosk'}
                {activeTab === 'payment' && 'Konfigurasi Pembayaran & Webhook'}
                {activeTab === 'templates' && 'Pengelola Template Grid Strip'}
                {activeTab === 'transactions' && 'Buku Transaksi & Keuangan'}
                {activeTab === 'gallery' && 'Log Histori Foto & Galeri Tamu'}
                {activeTab === 'hardware' && 'Status Perangkat Keras & Diagnostik'}
              </h2>
              <p className="text-gray-400 text-xs">
                {activeTab === 'overview' && 'Status operasional kiosk, pendapatan harian, dan kontrol instan'}
                {activeTab === 'payment' && 'Pengaturan Midtrans QRIS, harga sesi, webhook gateway, dan voucher'}
                {activeTab === 'templates' && 'Upload dan kelola frame strip foto (1333x1999) dengan auto-slot'}
                {activeTab === 'transactions' && 'Rekapitulasi pembayaran QRIS dan export data sesi photobooth'}
                {activeTab === 'gallery' && 'Koleksi foto cetak 4x6, strip foto, pose individual HD, dan video boomerang'}
                {activeTab === 'hardware' && 'Manajemen koneksi Canon DSLR EOS 6D dan printer foto dye-sublimation'}
              </p>
            </div>

            {/* Quick Status Badges & Controls */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#161F30] border border-gray-800 rounded-xl text-xs font-mono text-gray-300">
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                <span>{currentTime}</span>
              </div>

              {/* Camera Pill */}
              <div
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  cameraStatus?.connected
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    cameraStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>{activeProvider === 'gphoto2' ? 'Canon EOS 6D' : 'Mock Camera'}</span>
              </div>

              {/* Printer Pill */}
              <div
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  settings.dryRunPrinter
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                    : (printerStatus?.hardwareConnected ?? false)
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    settings.dryRunPrinter
                      ? 'bg-amber-400'
                      : (printerStatus?.hardwareConnected ?? false)
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-rose-400'
                  }`}
                />
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {settings.dryRunPrinter
                    ? 'Printer: Dry Run'
                    : (printerStatus?.hardwareConnected ?? false)
                    ? `Printer: ${printerStatus?.name || 'Online'}`
                    : 'Printer: OFFLINE'}
                </span>
              </div>

              {/* Theme Switcher Toggle (Dark / Day Mode) */}
              <div className="flex items-center bg-[#161F30] p-1 rounded-xl border border-gray-700/60">
                <button
                  type="button"
                  onClick={() => toggleTheme('dark')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Aktifkan Dark Mode (Tema Gelap)"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleTheme('light')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Aktifkan Day Mode (Tema Terang)"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Day</span>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  fetchStatus();
                  fetchSettings();
                  fetchTemplates();
                  fetchTransactions();
                }}
                disabled={isRefreshing}
                className="p-2.5 bg-[#161F30] hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl border border-gray-700/60 transition-all cursor-pointer"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-pink-400' : ''}`} />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2.5 bg-[#161F30] hover:bg-rose-900/40 text-gray-400 hover:text-rose-300 rounded-xl border border-gray-700/60 transition-all cursor-pointer"
                title="Tutup Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Main Content Scrollable Area */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ================= TAB 1: OVERVIEW ================= */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                {/* 4 Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Total Omzet Hari Ini
                    </span>
                    <div className="text-2xl font-display font-black text-emerald-400 font-mono">
                      Rp {(transactionStats.totalGrossAmount ?? 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2 block">
                      dari {(transactionStats.paidCount ?? 0)} sesi berbayar
                    </span>
                  </div>

                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-all" />
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Transaksi Selesai
                    </span>
                    <div className="text-2xl font-display font-black text-white font-mono">
                      {(transactionStats.paidCount ?? 0)} Sesi
                    </div>
                    <span className="text-[11px] text-emerald-400 mt-2 block flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pembayaran Terverifikasi
                    </span>
                  </div>

                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Voucher / Kasir Bypass
                    </span>
                    <div className="text-2xl font-display font-black text-purple-400 font-mono">
                      {(transactionStats.voucherCount ?? 0)} Sesi
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2 block">
                      Kode promo / tamu VIP
                    </span>
                  </div>

                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all" />
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Gateway Aktif
                    </span>
                    <div className="text-xl font-display font-black text-rose-400 capitalize">
                      {settings.payment.mode === 'free' ? 'Mode Gratis' : `${settings.payment.provider} QRIS`}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2 block font-mono">
                      Rp {(settings.payment.sessionPrice ?? 0).toLocaleString('id-ID')} / sesi
                    </span>
                  </div>
                </div>

                {/* Remote Admin Access Banner Card */}
                <div className="p-5 bg-gradient-to-r from-pink-950/40 via-[#111827] to-[#161F30] border border-pink-500/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Akses Admin Jarak Jauh (HP / Laptop Lain)</span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[10px] font-mono font-bold">LAN Terhubung</span>
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Buka link di bawah pada browser HP atau laptop di jaringan Wi-Fi yang sama untuk mengontrol photobooth:
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="px-3 py-1 bg-black/60 border border-gray-800 rounded-xl text-xs font-mono text-pink-300 select-all font-bold">
                          {networkInfo?.adminUrl || `http://${window.location.hostname}:4000/admin`}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            const url = networkInfo?.adminUrl || `http://${window.location.hostname}:4000/admin`;
                            navigator.clipboard.writeText(url);
                            setCopiedAdminUrl(true);
                            setTimeout(() => setCopiedAdminUrl(false), 2000);
                          }}
                          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {copiedAdminUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedAdminUrl ? 'Disalin!' : 'Salin URL'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <a
                    href={networkInfo?.adminUrl || `http://${window.location.hostname}:4000/admin`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md shadow-pink-600/30"
                  >
                    <span>Buka di Tab Baru</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Quick Controls Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Quick Toggles */}
                  <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sliders className="w-5 h-5 text-pink-400" />
                      <h3 className="text-base font-bold text-white">Kontrol Cepat Kiosk</h3>
                    </div>

                    {/* Mode Gratis vs Berbayar */}
                    <div className="p-4 bg-[#161F30]/70 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white block">Mode Operasional</span>
                        <span className="text-xs text-gray-400">
                          {settings.payment.mode === 'paid'
                            ? 'Pelanggan wajib scan QRIS sebelum foto'
                            : 'Pelanggan langsung foto tanpa pembayaran'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const newMode = settings.payment.mode === 'paid' ? 'free' : 'paid';
                          const updated = {
                            ...settings,
                            payment: { ...settings.payment, mode: newMode as any },
                          };
                          setSettings(updated);
                          fetch(getApiUrl('/api/admin/settings'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updated),
                          });
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          settings.payment.mode === 'paid'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {settings.payment.mode === 'paid' ? 'Mode Berbayar (QRIS)' : 'Mode Gratis (Event)'}
                      </button>
                    </div>

                    {/* Printer Dry Run Toggle */}
                    <div className="p-4 bg-[#161F30]/70 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white block">Mode Dry-Run Printer</span>
                        <span className="text-xs text-gray-400">
                          {settings.dryRunPrinter
                            ? 'Simulasi cetak (tidak membuang kertas foto asli)'
                            : 'Mencetak ke printer fisik secara nyata'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const newDry = !settings.dryRunPrinter;
                          const updated = { ...settings, dryRunPrinter: newDry };
                          setSettings(updated);
                          onSetPrinterDryRun(newDry);
                          fetch(getApiUrl('/api/admin/settings'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updated),
                          });
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          settings.dryRunPrinter
                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        }`}
                      >
                        {settings.dryRunPrinter ? 'Dry-Run AKTIF' : 'Cetak Fisik REAL'}
                      </button>
                    </div>

                    {/* Camera Provider Toggle */}
                    <div className="p-4 bg-[#161F30]/70 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white block">Provider Kamera</span>
                        <span className="text-xs text-gray-400">
                          {activeProvider === 'gphoto2' ? 'Canon EOS 6D via USB gphoto2' : 'Mock Camera Simulator'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSwitchCameraProvider('mock')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeProvider === 'mock'
                              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                              : 'bg-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          Mock
                        </button>
                        <button
                          onClick={() => handleSwitchCameraProvider('gphoto2')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeProvider === 'gphoto2'
                              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                              : 'bg-gray-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          Canon gphoto2
                        </button>
                      </div>
                    </div>

                    {/* Theme Mode Toggle (Dark vs Day Mode) */}
                    <div className="p-4 bg-[#161F30]/70 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white block">Tema Tampilan Admin</span>
                        <span className="text-xs text-gray-400">
                          {theme === 'dark'
                            ? 'Mode Gelap (Cyberpunk Dark Mode) aktif'
                            : 'Mode Terang (Daylight Clean Mode) aktif'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#0D121F] p-1 rounded-xl border border-gray-700/60">
                        <button
                          type="button"
                          onClick={() => toggleTheme('dark')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            theme === 'dark'
                              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title="Gunakan Tema Gelap"
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>Dark Mode</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTheme('light')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            theme === 'light'
                              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                              : 'text-gray-400 hover:text-white'
                          }`}
                          title="Gunakan Tema Terang"
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>Day Mode</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Active Template Peek */}
                  <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Layers className="w-5 h-5 text-pink-400" />
                          <h3 className="text-base font-bold text-white">Template Aktif ({templates.length})</h3>
                        </div>
                        <button
                          onClick={() => setActiveTab('templates')}
                          className="text-xs text-pink-400 hover:text-pink-300 font-bold"
                        >
                          Kelola Semua →
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {templates.slice(0, 3).map((tpl) => (
                          <div
                            key={tpl.id}
                            className="p-3 bg-[#161F30] border border-gray-800 rounded-2xl flex flex-col items-center text-center"
                          >
                            <img
                              src={`/api/templates/${tpl.id}/preview`}
                              alt={tpl.title}
                              className="h-28 object-contain rounded-lg mb-2 bg-black/40 p-1"
                            />
                            <span className="text-xs font-bold text-white truncate w-full">{tpl.title}</span>
                            <span className="text-[10px] text-pink-400 font-mono mt-0.5">
                              {tpl.poseCount} Pose ({tpl.allSlots?.length || 0} Kotak)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-[#161F30]/60 border border-gray-800 rounded-2xl flex items-center justify-between text-xs">
                      <span className="text-gray-400">Ingin menambahkan template baru?</span>
                      <button
                        onClick={() => setActiveTab('templates')}
                        className="px-3 py-1.5 bg-pink-600/90 hover:bg-pink-500 text-white font-bold rounded-xl transition-all"
                      >
                        Upload PNG
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: PEMBAYARAN & WEBHOOK ================= */}
            {activeTab === 'payment' && (
              <div className="space-y-6 animate-fade-in">
                {/* Save Notification Banner */}
                {settingsSavedMessage && (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{settingsSavedMessage}</span>
                  </div>
                )}

                {/* Gateway Configuration Card */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Konfigurasi Gateway & Tarif</h3>
                        <p className="text-xs text-gray-400">Atur provider pembayaran, tarif sesi, dan API keys</p>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-pink-600/30 flex items-center gap-2 cursor-pointer"
                    >
                      {isSavingSettings ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Mode Operasional */}
                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Mode Operasi Kiosk
                      </label>
                      <select
                        value={settings.payment.mode}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, mode: e.target.value as any },
                          })
                        }
                        className="w-full px-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-pink-500"
                      >
                        <option value="paid">Berbayar (Wajib QRIS Sebelum Foto)</option>
                        <option value="free">Gratis (Free Photo Event)</option>
                      </select>
                    </div>

                    {/* Provider */}
                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Payment Gateway Provider
                      </label>
                      <select
                        value={settings.payment.provider}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, provider: e.target.value as any },
                          })
                        }
                        className="w-full px-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-pink-500"
                      >
                        <option value="midtrans">Midtrans QRIS (GoPay, BCA, ShopeePay, dll)</option>
                        <option value="xendit">Xendit QRIS</option>
                        <option value="sandbox">Sandbox Mock Simulator (Internal Test)</option>
                      </select>
                    </div>

                    {/* Environment */}
                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Environment
                      </label>
                      <select
                        value={settings.payment.environment}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, environment: e.target.value as any },
                          })
                        }
                        className="w-full px-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-pink-500"
                      >
                        <option value="sandbox">Sandbox (Testing / Simulator)</option>
                        <option value="production">Production (Real Commercial Settlement)</option>
                      </select>
                    </div>

                    {/* Session Price */}
                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Tarif per Sesi Foto (IDR)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-sm text-gray-400 font-bold">Rp</span>
                        <input
                          type="number"
                          step={1000}
                          value={settings.payment.sessionPrice}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment: { ...settings.payment, sessionPrice: parseInt(e.target.value) || 0 },
                            })
                          }
                          className="w-full pl-12 pr-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>

                    {/* Extra Print Price */}
                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Tarif Tambah Cetakan (IDR)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-sm text-gray-400 font-bold">Rp</span>
                        <input
                          type="number"
                          step={1000}
                          value={settings.payment.extraPrintPrice}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment: { ...settings.payment, extraPrintPrice: parseInt(e.target.value) || 0 },
                            })
                          }
                          className="w-full pl-12 pr-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>

                    {/* QRIS Timeout */}
                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Batas Waktu QRIS (Detik)
                      </label>
                      <input
                        type="number"
                        value={settings.payment.qrisTimeoutSeconds}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            payment: { ...settings.payment, qrisTimeoutSeconds: parseInt(e.target.value) || 300 },
                          })
                        }
                        className="w-full px-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>

                  {/* Midtrans API Keys */}
                  <div className="pt-4 border-t border-gray-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-pink-400">
                      Kredensial API Midtrans
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-gray-400 font-semibold">Midtrans Server Key</label>
                          <button
                            type="button"
                            onClick={() => setShowServerKey(!showServerKey)}
                            className="text-[11px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
                          >
                            {showServerKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{showServerKey ? 'Sembunyikan' : 'Lihat'}</span>
                          </button>
                        </div>
                        <input
                          type={showServerKey ? 'text' : 'password'}
                          value={settings.payment.midtransServerKey}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment: { ...settings.payment, midtransServerKey: e.target.value },
                            })
                          }
                          placeholder="SB-Mid-server-..."
                          className="w-full px-4 py-2.5 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-400 font-semibold block mb-1.5">
                          Midtrans Client Key
                        </label>
                        <input
                          type="text"
                          value={settings.payment.midtransClientKey}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment: { ...settings.payment, midtransClientKey: e.target.value },
                            })
                          }
                          placeholder="SB-Mid-client-..."
                          className="w-full px-4 py-2.5 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-400 font-semibold block mb-1.5">
                          Midtrans Merchant ID
                        </label>
                        <input
                          type="text"
                          value={settings.payment.midtransMerchantId}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payment: { ...settings.payment, midtransMerchantId: e.target.value },
                            })
                          }
                          placeholder="M03945..."
                          className="w-full px-4 py-2.5 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1-Click Midtrans API Tester & Simulator Diagnostic */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Play className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Uji Koneksi Midtrans & Simulator QRIS</h3>
                        <p className="text-xs text-gray-400">
                          Tes keaslian Server Key langsung ke API Midtrans dan dapatkan URL simulator
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestMidtrans}
                      disabled={isTestingMidtrans}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                    >
                      {isTestingMidtrans ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>Test Koneksi Midtrans Sekarang</span>
                    </button>
                  </div>

                  {testMidtransResult && (
                    <div
                      className={`p-4 rounded-2xl border ${
                        testMidtransResult.success
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <p className="text-xs font-bold mb-3">{testMidtransResult.message}</p>

                      {testMidtransResult.success && (
                        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-[#090D16] border border-gray-800 rounded-2xl">
                          {testMidtransResult.qrImageUrl && (
                            <img
                              src={testMidtransResult.qrImageUrl}
                              alt="Diagnostic QRIS"
                              className="w-40 h-40 bg-white p-2 rounded-xl object-contain shadow-lg"
                            />
                          )}

                          <div className="space-y-3 flex-1 w-full text-xs">
                            <div>
                              <span className="text-gray-400 block font-semibold">Order ID Uji Coba:</span>
                              <span className="font-mono text-white font-bold">{testMidtransResult.orderId}</span>
                            </div>

                            <div>
                              <span className="text-gray-400 block font-semibold">Nominal Sesi:</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                Rp {(testMidtransResult.amount ?? settings.payment.sessionPrice).toLocaleString('id-ID')}
                              </span>
                            </div>

                            {/* Simulator URL Copy Button & 1-Click Simulation */}
                            <div className="pt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const qrUrl = testMidtransResult.qrCodeUrl || testMidtransResult.qrString;
                                    const res = await fetch(getApiUrl('/api/payment/simulate-midtrans-pay'), {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ qrCodeUrl: qrUrl }),
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      alert('✅ ' + data.message);
                                      fetchTransactions();
                                    } else {
                                      alert('Gagal: ' + (data.error || 'Terjadi kesalahan'));
                                    }
                                  } catch (err: any) {
                                    alert('Error: ' + err.message);
                                  }
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/30"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>⚡ Simulasi Bayar Sukses (1-Klik)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const urlToCopy = testMidtransResult.qrCodeUrl || testMidtransResult.qrString || '';
                                  navigator.clipboard.writeText(urlToCopy);
                                  alert(
                                    '✅ URL QRIS Berhasil Disalin!\n\n' +
                                    'Langkah test manual di simulator:\n' +
                                    '1. Buka simulator (https://simulator.sandbox.midtrans.com/v2/qris/index)\n' +
                                    '2. Paste ke kolom "QR Code Image Url"\n' +
                                    '3. Klik "Scan QR" lalu klik "Pay".'
                                  );
                                }}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-pink-400" />
                                <span>Salin URL QRIS</span>
                              </button>

                              <a
                                href="https://simulator.sandbox.midtrans.com/v2/qris/index"
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl font-bold flex items-center gap-1.5 transition-all"
                              >
                                <span>Buka Simulator Midtrans v2</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>

                            <p className="text-[11px] text-gray-400">
                              💡 <em>Catatan:</em> Midtrans Simulator resmi menggunakan <code>/v2/qris/index</code> untuk QRIS dinamis modern. Atau gunakan tombol <strong>⚡ Simulasi Bayar Sukses</strong> untuk instan test tanpa perlu membuka tab baru.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Webhook Gateway Notification URL */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Webhook Notification URL</h3>
                      <p className="text-xs text-gray-400">
                        URL ini didaftarkan di Dashboard Midtrans (MAP) agar transaksi settled secara real-time
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimulateWebhook}
                      className="px-3.5 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-gray-700/60 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-pink-400" />
                      <span>Kirim Simulasi Webhook Ping</span>
                    </button>
                  </div>

                  <div className="p-4 bg-[#090D16] border border-gray-800 rounded-2xl flex items-center justify-between gap-4">
                    <code className="text-xs text-pink-300 font-mono select-all truncate">{webhookUrl}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        alert('URL Webhook berhasil disalin ke clipboard!');
                      }}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin URL</span>
                    </button>
                  </div>

                  <div className="p-4 bg-blue-950/30 border border-blue-500/30 rounded-2xl text-xs text-blue-300 leading-relaxed space-y-1">
                    <p className="font-bold">Panduan Pengaturan di Midtrans MAP:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-blue-200">
                      <li>Buka <strong>dashboard.midtrans.com</strong> &gt; Settings &gt; Configuration.</li>
                      <li>Di bagian <strong>Payment Notification URL</strong>, tempelkan URL webhook di atas.</li>
                      <li>Jika menggunakan server lokal tanpa IP publik, gunakan tunnel relay (Cloudflare / ngrok).</li>
                    </ol>
                  </div>
                </div>

                {/* Voucher Codes Management */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Voucher Promo & PIN Kasir Tunai</h3>
                      <p className="text-xs text-gray-400">Kode kupon yang dapat digunakan pelanggan untuk bypass pembayaran</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Contoh: VIPFREE, PROMO50, CASH01"
                      value={newVoucherCode}
                      onChange={(e) => setNewVoucherCode(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddVoucher}
                      className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-pink-600/30"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Kode</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {settings.payment.activeVouchers?.map((code) => (
                      <div
                        key={code}
                        className="px-3.5 py-1.5 bg-[#161F30] border border-pink-500/30 rounded-xl text-xs font-mono font-bold text-pink-300 flex items-center gap-2"
                      >
                        <span>{code}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVoucher(code)}
                          className="hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: TEMPLATES ================= */}
            {activeTab === 'templates' && (
              <div className="space-y-6 animate-fade-in">
                {/* Upload Card */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                    <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Upload Template Strip Foto Baru</h3>
                      <p className="text-xs text-gray-400">
                        Format PNG transparan 1333x1999 piksel (standar cetak foto strip 4x6 inci 2-up)
                      </p>
                    </div>
                  </div>

                  {templateUploadMessage && (
                    <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>{templateUploadMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleUploadTemplate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                          Nama / Judul Template
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Elegant Vintage Floral Strip"
                          value={templateTitle}
                          onChange={(e) => setTemplateTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                          Jumlah Pose Pengambilan
                        </label>
                        <select
                          value={templatePoseCount}
                          onChange={(e) => setTemplatePoseCount(parseInt(e.target.value) || 3)}
                          className="w-full px-4 py-3 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-pink-500"
                        >
                          <option value={3}>3 Pose (Standar 3 Kotak per strip)</option>
                          <option value={4}>4 Pose (4 Kotak per strip)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block mb-2">
                        Pilih File PNG Transparan
                      </label>
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setTemplateFile(e.target.files[0]);
                          }
                        }}
                        className="w-full px-4 py-3 bg-[#161F30] border border-dashed border-gray-700 rounded-xl text-gray-300 text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isUploadingTemplate || !templateFile}
                      className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-pink-600/30 flex items-center gap-2 cursor-pointer"
                    >
                      {isUploadingTemplate ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>Proses & Simpan Template</span>
                    </button>
                  </form>
                </div>

                {/* Templates List */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300">
                    Daftar Template Tersedia ({templates.length})
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-4 bg-[#111827] border border-gray-800/80 rounded-3xl flex flex-col justify-between space-y-4 shadow-lg hover:border-pink-500/40 transition-all"
                      >
                        <div className="flex gap-4 items-start">
                          <img
                            src={`/api/templates/${tpl.id}/preview`}
                            alt={tpl.title}
                            className="w-24 h-36 object-contain rounded-xl bg-black/50 p-1 shrink-0 border border-gray-800"
                          />
                          <div className="flex-1 overflow-hidden">
                            <h4 className="text-sm font-bold text-white truncate">{tpl.title}</h4>
                            <span className="text-[11px] text-pink-400 font-mono font-semibold block mt-0.5">
                              {tpl.poseCount} Pose ({tpl.allSlots?.length || 0} Slots)
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block mt-1">
                              Canvas: {tpl.canvasWidth}x{tpl.canvasHeight}px
                            </span>
                            <span className="text-[10px] text-gray-500 truncate block mt-0.5">
                              {tpl.filename}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                          <button
                            type="button"
                            onClick={() => handleToggleTemplate(tpl.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              tpl.isActive !== false
                                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {tpl.isActive !== false ? 'Aktif' : 'Nonaktif'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                            title="Hapus Template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: TRANSAKSI & SESI ================= */}
            {activeTab === 'transactions' && (
              <div className="space-y-6 animate-fade-in">
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Total Omzet (Settle)
                    </span>
                    <div className="text-2xl font-display font-black text-emerald-400 font-mono">
                      Rp {(transactionStats?.totalGrossAmount ?? 0).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Transaksi Selesai
                    </span>
                    <div className="text-2xl font-display font-black text-white font-mono">
                      {(transactionStats?.paidCount ?? 0)} Sesi
                    </div>
                  </div>

                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Voucher / Kasir Bypass
                    </span>
                    <div className="text-2xl font-display font-black text-pink-400 font-mono">
                      {(transactionStats?.voucherCount ?? 0)} Sesi
                    </div>
                  </div>

                  <div className="p-5 bg-[#111827] border border-gray-800/80 rounded-2xl">
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                      Total Upaya Transaksi
                    </span>
                    <div className="text-2xl font-display font-black text-gray-300 font-mono">
                      {(transactionStats?.totalTransactions ?? transactions.length)}
                    </div>
                  </div>
                </div>

                {/* Filter and Export Bar */}
                <div className="p-4 bg-[#111827] border border-gray-800/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Cari Order / Sesi ID..."
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <select
                      value={txFilterStatus}
                      onChange={(e) => setTxFilterStatus(e.target.value as any)}
                      className="px-3 py-2 bg-[#161F30] border border-gray-700/80 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-pink-500"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="PAID">PAID (Sukses)</option>
                      <option value="PENDING">PENDING</option>
                      <option value="VOUCHER">VOUCHER</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  <a
                    href={getApiUrl('/api/admin/transactions?export=csv')}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-pink-400" />
                    <span>Download Laporan CSV</span>
                  </a>
                </div>

                {/* Ledger Table */}
                <div className="bg-[#111827] border border-gray-800/80 rounded-3xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#161F30] text-gray-400 uppercase font-mono tracking-wider border-b border-gray-800">
                        <tr>
                          <th className="py-3 px-4">Waktu</th>
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Session ID</th>
                          <th className="py-3 px-4">Provider</th>
                          <th className="py-3 px-4">Nominal</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 font-mono">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                              Tidak ada riwayat transaksi yang cocok.
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((tx) => (
                            <tr key={tx.orderId} className="hover:bg-[#161F30]/40 transition-colors">
                              <td className="py-3 px-4 text-gray-400">
                                {new Date(tx.paidAt || tx.expiresAt).toLocaleTimeString('id-ID')}
                              </td>
                              <td className="py-3 px-4 font-bold text-white">{tx.orderId}</td>
                              <td className="py-3 px-4 text-gray-400 truncate max-w-[120px]">{tx.sessionId}</td>
                              <td className="py-3 px-4 uppercase text-gray-400">{tx.provider}</td>
                              <td className="py-3 px-4 text-emerald-400 font-bold">
                                Rp {(tx.amount ?? 0).toLocaleString('id-ID')}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                    tx.status === 'PAID'
                                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                                      : tx.status === 'VOUCHER'
                                      ? 'bg-purple-950/60 text-purple-400 border border-purple-500/40'
                                      : tx.status === 'PENDING'
                                      ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                                      : 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                                  }`}
                                >
                                  {tx.status}
                                </span>
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

            {/* ================= TAB 5: LOG HISTORI FOTO ================= */}
            {activeTab === 'gallery' && (
              <div className="space-y-6 animate-fade-in">
                {/* Stats Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#111827] border border-gray-800/80 rounded-2xl flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <Images className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Total Sesi Foto</p>
                      <p className="text-xl font-bold font-mono text-white">{photoSessions.length}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#111827] border border-gray-800/80 rounded-2xl flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Dengan Strip 4x6</p>
                      <p className="text-xl font-bold font-mono text-cyan-400">
                        {photoSessions.filter((s) => s.hasPrint || s.hasStrip).length}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#111827] border border-gray-800/80 rounded-2xl flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Film className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Video Boomerang</p>
                      <p className="text-xl font-bold font-mono text-amber-400">
                        {photoSessions.filter((s) => s.hasBoomerang).length}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#111827] border border-gray-800/80 rounded-2xl flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Total Pose Tersimpan</p>
                      <p className="text-xl font-bold font-mono text-emerald-400">
                        {photoSessions.reduce((acc, s) => acc + s.poseCount, 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reprint Message Banner */}
                {reprintMessage && (
                  <div className="p-4 bg-pink-950/40 border border-pink-500/40 rounded-2xl flex items-center justify-between text-xs text-pink-300 animate-fade-in shadow-lg">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-pink-400 shrink-0" />
                      <span>{reprintMessage}</span>
                    </div>
                    <button
                      onClick={() => setReprintMessage(null)}
                      className="text-pink-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#111827] p-4 rounded-2xl border border-gray-800/80">
                  <div className="flex-1 w-full flex items-center gap-2 bg-[#161F30] px-3.5 py-2 rounded-xl border border-gray-800">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari ID Sesi (contoh: mwvudlac) atau tanggal..."
                      value={photoSearch}
                      onChange={(e) => setPhotoSearch(e.target.value)}
                      className="w-full bg-transparent text-xs text-gray-200 focus:outline-none placeholder-gray-500 font-mono"
                    />
                    {photoSearch && (
                      <button
                        onClick={() => setPhotoSearch('')}
                        className="text-gray-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <button
                      onClick={() => setPhotoFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        photoFilter === 'ALL'
                          ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                          : 'bg-[#161F30] text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      Semua ({photoSessions.length})
                    </button>
                    <button
                      onClick={() => setPhotoFilter('PRINT')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        photoFilter === 'PRINT'
                          ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                          : 'bg-[#161F30] text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      Strip Foto ({photoSessions.filter((s) => s.hasPrint || s.hasStrip).length})
                    </button>
                    <button
                      onClick={() => setPhotoFilter('BOOMERANG')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        photoFilter === 'BOOMERANG'
                          ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                          : 'bg-[#161F30] text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      Boomerang ({photoSessions.filter((s) => s.hasBoomerang).length})
                    </button>

                    <button
                      onClick={fetchPhotoHistory}
                      disabled={isLoadingPhotos}
                      className="p-2 bg-[#161F30] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded-xl transition-all cursor-pointer shrink-0"
                      title="Refresh Log Foto"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingPhotos ? 'animate-spin text-pink-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Photo Cards Grid */}
                {photoSessions.length === 0 ? (
                  <div className="p-12 text-center bg-[#111827] border border-gray-800/80 rounded-3xl space-y-3">
                    <Images className="w-12 h-12 text-gray-600 mx-auto" />
                    <p className="text-gray-300 text-sm font-bold">Belum ada histori sesi foto</p>
                    <p className="text-gray-500 text-xs">
                      Foto dan video yang diambil oleh pengunjung kiosk akan otomatis tersimpan dan terarsip di sini.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {photoSessions
                      .filter((s) => {
                        const matchSearch =
                          photoSearch === '' ||
                          s.sessionId.toLowerCase().includes(photoSearch.toLowerCase()) ||
                          new Date(s.createdAt).toLocaleDateString('id-ID').includes(photoSearch);
                        if (!matchSearch) return false;
                        if (photoFilter === 'PRINT') return s.hasPrint || s.hasStrip;
                        if (photoFilter === 'BOOMERANG') return s.hasBoomerang;
                        return true;
                      })
                      .map((session) => (
                        <div
                          key={session.sessionId}
                          className="bg-[#111827] border border-gray-800/80 rounded-2xl overflow-hidden hover:border-pink-500/50 transition-all flex flex-col group shadow-lg"
                        >
                          {/* Image Thumbnail Box */}
                          <div
                            onClick={() => {
                              setSelectedSession(session);
                              setSelectedMediaMode(session.hasPrint ? 'print' : (session.hasStrip ? 'strip' : 'poses'));
                            }}
                            className="aspect-[2/3] bg-black/60 relative overflow-hidden cursor-pointer flex items-center justify-center"
                          >
                            {session.thumbUrl ? (
                              <img
                                src={getApiUrl(session.thumbUrl)}
                                alt={`Sesi ${session.sessionId}`}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-gray-600">
                                <Images className="w-8 h-8" />
                                <span className="text-[10px]">No Thumbnail</span>
                              </div>
                            )}

                            {/* Floating Badges */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              <span className="px-2 py-0.5 bg-black/75 backdrop-blur-md rounded-md text-[10px] font-mono font-bold text-gray-200 border border-white/10 shadow">
                                {new Date(session.createdAt).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            </div>

                            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                              {session.hasPrint && (
                                <span className="px-2 py-0.5 bg-pink-600/90 text-white rounded-md text-[9px] font-bold shadow">
                                  4x6 Strip
                                </span>
                              )}
                              {session.hasBoomerang && (
                                <span className="px-2 py-0.5 bg-amber-500/90 text-black rounded-md text-[9px] font-bold shadow flex items-center gap-0.5">
                                  <Film className="w-2.5 h-2.5" /> MP4
                                </span>
                              )}
                              {session.poseCount > 0 && (
                                <span className="px-2 py-0.5 bg-cyan-600/90 text-white rounded-md text-[9px] font-bold shadow">
                                  {session.poseCount} Pose
                                </span>
                              )}
                            </div>

                            {/* Hover Quick Preview Pill */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="px-3 py-1.5 bg-pink-600/90 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                <Eye className="w-3.5 h-3.5" /> Buka Detail
                              </span>
                            </div>
                          </div>

                          {/* Card Footer Info & Actions */}
                          <div className="p-3 bg-[#0E1424] border-t border-gray-800/80 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-pink-400 truncate max-w-[140px]">
                                {session.sessionId}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {new Date(session.createdAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {session.hasPrint ? (
                                <button
                                  onClick={() => handleReprintSession(session.sessionId)}
                                  disabled={isReprinting}
                                  className="py-1.5 px-2 bg-[#161F30] hover:bg-pink-950/60 hover:text-pink-300 text-gray-300 border border-gray-700/60 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  title="Cetak Ulang Strip Foto ke Printer Kiosk"
                                >
                                  <Printer className="w-3 h-3 text-pink-400" />
                                  <span>Cetak Ulang</span>
                                </button>
                              ) : (
                                <div className="py-1.5 px-2 text-[10px] text-gray-500 text-center font-mono">
                                  Non-cetak
                                </div>
                              )}

                              <a
                                href={getApiUrl(`/share/${session.sessionId}`)}
                                target="_blank"
                                rel="noreferrer"
                                className="py-1.5 px-2 bg-[#161F30] hover:bg-gray-800 text-gray-300 border border-gray-700/60 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer text-center"
                                title="Buka Halaman Mobile QR Tamu"
                              >
                                <ExternalLink className="w-3 h-3 text-cyan-400" />
                                <span>QR Tamu</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Lightbox / Detail Modal */}
                {selectedSession && (
                  <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fade-in">
                    <div className="bg-[#0D121F] border border-gray-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                      {/* Modal Header */}
                      <div className="px-6 py-4 bg-[#111827] border-b border-gray-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-pink-500/10 rounded-xl text-pink-400 border border-pink-500/20">
                            <Images className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">Sesi {selectedSession.sessionId}</h3>
                              <button
                                onClick={() => navigator.clipboard.writeText(selectedSession.sessionId)}
                                className="p-1 hover:text-pink-400 text-gray-400 transition-colors cursor-pointer"
                                title="Salin Session ID"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-400 font-mono">
                              Waktu Pengambilan:{' '}
                              {new Date(selectedSession.createdAt).toLocaleString('id-ID', {
                                dateStyle: 'full',
                                timeStyle: 'short',
                              })}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedSession(null)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Modal View Selector Tabs */}
                      <div className="px-6 py-2.5 bg-[#0A0E18] border-b border-gray-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
                        {selectedSession.hasPrint && (
                          <button
                            onClick={() => setSelectedMediaMode('print')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              selectedMediaMode === 'print'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                                : 'text-gray-400 hover:text-white bg-gray-800/40'
                            }`}
                          >
                            Cetak 4x6 2-Up
                          </button>
                        )}
                        {selectedSession.hasStrip && (
                          <button
                            onClick={() => setSelectedMediaMode('strip')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              selectedMediaMode === 'strip'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                                : 'text-gray-400 hover:text-white bg-gray-800/40'
                            }`}
                          >
                            Strip Tunggal
                          </button>
                        )}
                        {selectedSession.poses.length > 0 && (
                          <button
                            onClick={() => setSelectedMediaMode('poses')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              selectedMediaMode === 'poses'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                                : 'text-gray-400 hover:text-white bg-gray-800/40'
                            }`}
                          >
                            Pose Individual HD ({selectedSession.poses.length})
                          </button>
                        )}
                        {selectedSession.hasBoomerang && (
                          <button
                            onClick={() => setSelectedMediaMode('boomerang')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              selectedMediaMode === 'boomerang'
                                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                                : 'text-gray-400 hover:text-white bg-gray-800/40'
                            }`}
                          >
                            Video Boomerang
                          </button>
                        )}
                      </div>

                      {/* Modal Preview Body */}
                      <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center bg-[#070B14]">
                        {selectedMediaMode === 'print' && selectedSession.printUrl && (
                          <div className="flex flex-col items-center gap-4 max-h-full">
                            <img
                              src={getApiUrl(selectedSession.printUrl)}
                              alt="Print 4x6 2-Up"
                              className="max-h-[55vh] object-contain rounded-xl border border-gray-800 shadow-2xl"
                            />
                            <div className="flex items-center gap-3">
                              <a
                                href={getApiUrl(selectedSession.printUrl)}
                                download={`print_4x6_${selectedSession.sessionId}.jpg`}
                                className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5 text-pink-400" /> Unduh File Cetak 4x6
                              </a>
                            </div>
                          </div>
                        )}

                        {selectedMediaMode === 'strip' && selectedSession.stripUrl && (
                          <div className="flex flex-col items-center gap-4 max-h-full">
                            <img
                              src={getApiUrl(selectedSession.stripUrl)}
                              alt="Photo Strip"
                              className="max-h-[55vh] object-contain rounded-xl border border-gray-800 shadow-2xl"
                            />
                            <div className="flex items-center gap-3">
                              <a
                                href={getApiUrl(selectedSession.stripUrl)}
                                download={`strip_${selectedSession.sessionId}.jpg`}
                                className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5 text-pink-400" /> Unduh Strip Foto
                              </a>
                            </div>
                          </div>
                        )}

                        {selectedMediaMode === 'poses' && (
                          <div className="w-full">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {selectedSession.poses.map((poseUrl, idx) => (
                                <div
                                  key={idx}
                                  className="bg-[#111827] p-2.5 rounded-2xl border border-gray-800 flex flex-col gap-2"
                                >
                                  <div className="aspect-[3/2] bg-black rounded-xl overflow-hidden relative flex items-center justify-center">
                                    <img
                                      src={getApiUrl(poseUrl)}
                                      alt={`Pose ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-black/75 rounded text-[10px] font-bold text-white shadow">
                                      Pose {idx + 1}
                                    </span>
                                  </div>
                                  <a
                                    href={getApiUrl(poseUrl)}
                                    download={`pose_${idx + 1}_${selectedSession.sessionId}.jpg`}
                                    className="w-full py-1.5 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all"
                                  >
                                    <Download className="w-3 h-3 text-cyan-400" /> Unduh Pose {idx + 1}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedMediaMode === 'boomerang' && selectedSession.boomerangMp4Url && (
                          <div className="flex flex-col items-center gap-4 max-h-full">
                            <div className="aspect-[2/3] max-h-[50vh] bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                              <video
                                src={getApiUrl(selectedSession.boomerangMp4Url)}
                                autoPlay
                                loop
                                muted
                                playsInline
                                controls
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <a
                                href={getApiUrl(selectedSession.boomerangMp4Url)}
                                download={`boomerang_${selectedSession.sessionId}.mp4`}
                                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" /> Unduh MP4
                              </a>
                              {selectedSession.boomerangGifUrl && (
                                <a
                                  href={getApiUrl(selectedSession.boomerangGifUrl)}
                                  download={`boomerang_${selectedSession.sessionId}.gif`}
                                  className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold flex items-center gap-2"
                                >
                                  <Download className="w-3.5 h-3.5" /> Unduh GIF
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Modal Footer Controls */}
                      <div className="px-6 py-4 bg-[#111827] border-t border-gray-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={getApiUrl(`/share/${selectedSession.sessionId}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> Buka Halaman Mobile Tamu
                          </a>
                        </div>

                        <div className="flex items-center gap-3">
                          {selectedSession.hasPrint && (
                            <button
                              onClick={() => handleReprintSession(selectedSession.sessionId)}
                              disabled={isReprinting}
                              className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                            >
                              <Printer className="w-4 h-4" />
                              <span>{isReprinting ? 'Mengirim ke Printer...' : 'Cetak Ulang Sesi Ini'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedSession(null)}
                            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
                          >
                            Tutup
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 6: HARDWARE ================= */}
            {activeTab === 'hardware' && (
              <div className="space-y-6 animate-fade-in">
                {/* Camera Card */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Kamera DSLR Canon</h3>
                        <p className="text-xs text-gray-400 font-mono">
                          {cameraStatus?.model || 'Simulated Canon EOS 6D'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                        cameraStatus?.connected
                          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                          : 'bg-amber-950/60 border border-amber-500/40 text-amber-400'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          cameraStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        }`}
                      />
                      <span>{cameraStatus?.connected ? 'TERHUBUNG' : 'DISCONNECTED'}</span>
                    </span>
                  </div>

                  {cameraSwitchMessage && (
                    <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-2xl text-pink-300 text-xs font-semibold animate-fade-in flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-pink-400" />
                      <span>{cameraSwitchMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchCameraProvider('mock')}
                      disabled={isSwitchingCamera}
                      className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeProvider === 'mock'
                          ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-lg shadow-pink-600/30'
                          : 'bg-[#161F30] text-gray-400 hover:text-white border border-gray-700/60'
                      }`}
                    >
                      {isSwitchingCamera && activeProvider === 'mock' && (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      )}
                      <span>Gunakan Mock Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchCameraProvider('gphoto2')}
                      disabled={isSwitchingCamera}
                      className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeProvider === 'gphoto2'
                          ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-lg shadow-pink-600/30'
                          : 'bg-[#161F30] text-gray-400 hover:text-white border border-gray-700/60'
                      }`}
                    >
                      {isSwitchingCamera && activeProvider === 'gphoto2' && (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      )}
                      <span>Gunakan Canon gphoto2</span>
                    </button>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTriggerTestShot}
                      className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-pink-400" />
                      <span>Ambil Test Shot</span>
                    </button>

                    {testShotResult && (
                      <span className="text-xs text-gray-300 font-mono truncate">{testShotResult}</span>
                    )}
                  </div>
                </div>

                {/* Printer Card */}
                <div className="p-6 bg-[#111827] border border-gray-800/80 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <Printer className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Printer Photo Kiosk</h3>
                        {settings.dryRunPrinter ? (
                          <p className="text-xs text-amber-400 font-medium mt-0.5">
                            Virtual Printer Spooler Simulator (Dry-Run Mode)
                          </p>
                        ) : (printerStatus?.hardwareConnected ?? false) ? (
                          <p className="text-xs text-emerald-400 font-mono mt-0.5">
                            {printerStatus?.name || 'Default_Photo_Printer'}
                          </p>
                        ) : (
                          <p className="text-xs text-rose-400 font-medium mt-0.5">
                            Tidak ada printer fisik terdeteksi di sistem OS (macOS/Windows)
                          </p>
                        )}
                      </div>
                    </div>

                    {settings.dryRunPrinter ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-950/60 border border-amber-500/40 text-amber-400 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>SIMULASI (DRY-RUN)</span>
                      </span>
                    ) : (printerStatus?.hardwareConnected ?? false) ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>TERHUBUNG (ONLINE)</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>TERPUTUS (OFFLINE)</span>
                      </span>
                    )}
                  </div>

                  {/* List of Detected Physical Printers */}
                  {printerStatus?.detectedPrinters && printerStatus.detectedPrinters.length > 0 && (
                    <div className="p-3 bg-[#161F30]/70 border border-gray-800 rounded-2xl flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        Printer Terpasang ({printerStatus.detectedPrinters.length}):
                      </span>
                      <span className="font-mono text-pink-400 font-bold">
                        {printerStatus.detectedPrinters.join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="p-4 bg-[#161F30]/70 border border-gray-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white block">Mode Dry-Run (Simulasi)</span>
                      <span className="text-xs text-gray-400">
                        Mencegah pemborosan kertas foto asli saat proses testing & development
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newDry = !settings.dryRunPrinter;
                        const updated = { ...settings, dryRunPrinter: newDry };
                        setSettings(updated);
                        onSetPrinterDryRun(newDry);
                        fetch(getApiUrl('/api/admin/settings'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updated),
                        });
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settings.dryRunPrinter
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                          : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      }`}
                    >
                      {settings.dryRunPrinter ? 'DRY RUN AKTIF' : 'CETAK FISIK REAL'}
                    </button>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTestPrint}
                        disabled={isTestingPrint}
                        className="px-4 py-2 bg-[#161F30] hover:bg-gray-800 text-gray-200 border border-gray-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Printer className="w-3.5 h-3.5 text-pink-400" />
                        <span>{isTestingPrint ? 'Mengirim Test Print...' : 'Kirim Test Print Page'}</span>
                      </button>
                    </div>

                    {testPrintResult && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
                          testPrintResult.success
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        <span>{testPrintResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
