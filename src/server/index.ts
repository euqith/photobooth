import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import os from 'os';
import qrcode from 'qrcode';
import sharp from 'sharp';
import { SessionManager } from './sessionManager';
import { CameraManager } from './camera/cameraManager';
import { PrinterService } from './printer/printerService';
import { TemplateCompositor } from './template/compositor';
import { TemplateInspectorService } from './template/templateInspector';
import { PaymentManager } from './payment/paymentManager';
import { SettingsManager } from './config/settingsManager';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e7, // 10MB buffer for live view frames
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve static assets: dist/renderer (built React UI), public/ (templates, videos), and output/
const distRendererDir = path.resolve(__dirname, '../../dist/renderer');
const publicDir = path.resolve(__dirname, '../../public');
const outputDir = path.resolve(__dirname, '../../output');

if (fs.existsSync(distRendererDir)) {
  app.use(express.static(distRendererDir));
}
app.use(express.static(publicDir));
app.use('/output', express.static(outputDir));

// Helper: Get local IP for Wi-Fi Hotspot sharing
function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const sessionManager = new SessionManager(io);
const cameraManager = CameraManager.getInstance();
const printerService = PrinterService.getInstance();
const paymentManager = PaymentManager.getInstance();
const settingsManager = SettingsManager.getInstance();

// REST APIs
app.get('/api/health', async (req, res) => {
  const camHealth = await cameraManager.getHealth();
  const printStatus = printerService.getStatus();
  const settings = settingsManager.getSettings();
  const revenue = paymentManager.getDailyRevenue();

  res.json({
    status: 'ok',
    camera: camHealth,
    printer: printStatus,
    settings,
    revenue,
    localIp: getLocalIp(),
  });
});

// Settings API
app.get('/api/admin/settings', (req, res) => {
  res.json(settingsManager.getSettings());
});

app.post('/api/admin/settings', (req, res) => {
  const updated = settingsManager.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// Transactions Ledger & Revenue API
app.get('/api/admin/transactions', (req, res) => {
  res.json({
    transactions: paymentManager.getAllTransactions(),
    daily: paymentManager.getDailyRevenue(),
  });
});

app.get('/api/admin/transactions/export-csv', (req, res) => {
  const txs = paymentManager.getAllTransactions();
  let csv = 'Order ID,Session ID,Amount,Provider,Status,Created At,Paid At\n';
  txs.forEach((t) => {
    csv += `"${t.orderId}","${t.sessionId}",${t.amount},"${t.provider}","${t.status}","${new Date(t.expiresAt - 5*60000).toISOString()}","${t.paidAt ? new Date(t.paidAt).toISOString() : ''}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="photobooth_transactions.csv"');
  res.send(csv);
});

// Payment Webhook Receiver (Midtrans, Xendit, Cloud Relay)
app.post('/api/payment/webhook', (req, res) => {
  console.log('[Webhook Received]:', req.body);
  const settled = paymentManager.handleWebhookNotification(req.body);
  res.json({ received: true, settled });
});

// Test Connection & Simulate Webhook Endpoint
app.post('/api/admin/test-webhook', (req, res) => {
  const current = paymentManager.getCurrentTransaction();
  if (current) {
    const settled = paymentManager.simulateSandboxSuccess();
    return res.json({ success: true, message: 'Simulated webhook processed', settled });
  }
  res.json({ success: true, message: 'Test ping OK' });
});

// Template Management API
app.get('/api/templates', (req, res) => {
  res.json(TemplateInspectorService.getAllTemplates());
});

// Upload New Template PNG (using raw base64 or file buffer)
app.post('/api/admin/templates/upload', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const { title, imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const templateId = 'custom_' + Date.now();
    const tempPath = path.join(os.tmpdir(), `${templateId}.png`);
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(tempPath, Buffer.from(cleanBase64, 'base64'));

    const meta = await TemplateInspectorService.processAndSaveTemplate(templateId, title, tempPath);
    try { fs.unlinkSync(tempPath); } catch {}

    res.json({ success: true, template: meta });
  } catch (err: any) {
    console.error('Template upload error:', err);
    res.status(500).json({ error: err?.message || 'Failed to process template' });
  }
});

app.post('/api/admin/templates/:id/toggle', (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const success = TemplateInspectorService.toggleTemplateActive(id, !!isActive);
  res.json({ success });
});

app.delete('/api/admin/templates/:id', (req, res) => {
  const { id } = req.params;
  const success = TemplateInspectorService.deleteTemplate(id);
  res.json({ success });
});

// Mobile QR Code Landing Page for Guests
app.get('/share/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(outputDir, 'sessions', sessionId);
  const printImgUrl = `/output/sessions/${sessionId}/print_4x6_2up.jpg`;
  const stripImgUrl = `/output/sessions/${sessionId}/print_4x6_2up_strip.jpg`;
  const boomerangMp4Url = `/output/sessions/${sessionId}/boomerang.mp4`;
  const boomerangGifUrl = `/output/sessions/${sessionId}/boomerang.gif`;

  // Check if individual poses exist & ensure web-optimized thumbnails exist
  const poses: { num: number; url: string; thumbUrl: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const pPath = path.join(sessionDir, `pose_${i}.jpg`);
    const thumbPath = path.join(sessionDir, `pose_${i}_thumb.jpg`);
    if (fs.existsSync(pPath)) {
      if (!fs.existsSync(thumbPath)) {
        try {
          await sharp(pPath)
            .rotate()
            .resize(800, null, { withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
        } catch {
          // fallback to raw
        }
      }
      poses.push({
        num: i,
        url: `/output/sessions/${sessionId}/pose_${i}.jpg`,
        thumbUrl: fs.existsSync(thumbPath)
          ? `/output/sessions/${sessionId}/pose_${i}_thumb.jpg`
          : `/output/sessions/${sessionId}/pose_${i}.jpg`,
      });
    }
  }

  const hasBoomerang = fs.existsSync(path.join(sessionDir, 'boomerang.mp4'));

  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Foto Photobooth Kamu</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Poppins', sans-serif; }
      </style>
    </head>
    <body class="bg-gray-950 text-white min-h-screen flex flex-col items-center p-4 sm:p-6 pb-16">
      <div class="max-w-md w-full flex flex-col items-center">
        <!-- Brand Header -->
        <div class="text-center my-4">
          <span class="text-xs uppercase tracking-widest text-pink-500 font-bold">Photobooth Digital Gallery</span>
          <h1 class="text-2xl font-display font-extrabold text-white mt-1">✨ Kenangan Seru Kamu!</h1>
          <p class="text-gray-400 text-xs mt-1">Unduh foto strip lengkap (2 sisi), boomerang, dan pose jepretanmu.</p>
        </div>

        <!-- Section 1: Photo Strip Card with 2-Sisi (Full 4R) vs 1-Sisi Switcher -->
        <div class="w-full bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center mb-6">
          <div class="flex items-center justify-between w-full mb-3">
            <span class="text-xs font-bold text-pink-400 uppercase tracking-wider">Hasil Desain Kolase</span>
            <span class="text-[10px] bg-pink-500/20 text-pink-300 px-2.5 py-1 rounded-full font-semibold">Siap Cetak & Share</span>
          </div>

          <!-- View Switcher Tabs (2 Sisi vs 1 Sisi) -->
          <div class="flex bg-gray-800/80 p-1 rounded-xl w-full mb-4 border border-gray-700/60 text-xs font-bold">
            <button id="btn-tab-full" onclick="switchStripView('full')" class="flex-1 py-2 rounded-lg transition-all bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md">
              🖼️ 2 Sisi (Full 4R)
            </button>
            <button id="btn-tab-single" onclick="switchStripView('single')" class="flex-1 py-2 rounded-lg transition-all text-gray-400 hover:text-white">
              📱 1 Sisi (Strip 2x6")
            </button>
          </div>
          
          <div class="bg-black/60 p-2 rounded-2xl border border-gray-800 w-full flex justify-center mb-4 min-h-[280px] items-center">
            <img id="preview-strip-img" src="${printImgUrl}" alt="Photo Strip Preview" class="rounded-xl max-h-[52vh] object-contain shadow-2xl transition-all duration-300" onerror="this.src='${stripImgUrl}'" />
          </div>

          <div class="flex flex-col gap-2.5 w-full">
            <a href="${printImgUrl}" download="photobooth_full_4R.jpg" class="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl font-bold text-center text-sm shadow-lg shadow-pink-500/20 active:scale-95 transition-all">
              📥 Unduh Full 4R (2 Sisi Lengkap)
            </a>
            <a href="${stripImgUrl}" download="photobooth_strip.jpg" class="w-full py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-center text-xs text-gray-300 border border-gray-700 active:scale-95 transition-all">
              📱 Unduh 1 Sisi (Strip 2x6")
            </a>
          </div>
        </div>

        <!-- Section 2: Boomerang Video Card (if available) -->
        ${
          hasBoomerang
            ? `
        <div class="w-full bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center mb-6">
          <div class="flex items-center justify-between w-full mb-3">
            <span class="text-xs font-bold text-yellow-400 uppercase tracking-wider">🎬 Boomerang Video Loop</span>
            <span class="text-[10px] bg-yellow-500/20 text-yellow-300 px-2.5 py-1 rounded-full font-semibold">Instagram & TikTok Ready</span>
          </div>

          <div class="w-full rounded-2xl overflow-hidden bg-black aspect-[2/3] max-h-[45vh] flex justify-center mb-4 border border-gray-800">
            <video src="${boomerangMp4Url}" autoplay loop muted playsinline class="h-full w-full object-cover"></video>
          </div>

          <div class="grid grid-cols-2 gap-3 w-full">
            <a href="${boomerangMp4Url}" download="photobooth_boomerang.mp4" class="py-3 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl font-bold text-center text-xs text-white shadow-lg active:scale-95 transition-all">
              🎥 Unduh MP4
            </a>
            <a href="${boomerangGifUrl}" download="photobooth_boomerang.gif" class="py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-center text-xs text-gray-300 border border-gray-700 active:scale-95 transition-all">
              🎞️ Unduh GIF
            </a>
          </div>
        </div>
        `
            : ''
        }

        <!-- Section 3: Individual Poses Gallery (Landscape Aspect Ratio + Fast Thumbnails) -->
        ${
          poses.length > 0
            ? `
        <div class="w-full bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-2xl flex flex-col mb-6">
          <div class="flex items-center justify-between w-full mb-3">
            <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider">📸 Foto Individual Resolusi Tinggi</span>
            <span class="text-[10px] bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-full font-semibold">${poses.length} Pose</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${poses
              .map(
                (p) => `
              <div class="flex flex-col bg-gray-800/80 rounded-2xl p-2 border border-gray-700/60 shadow-lg">
                <div class="aspect-[3/2] rounded-xl overflow-hidden bg-black mb-2 relative flex items-center justify-center">
                  <img src="${p.thumbUrl}" alt="Pose ${p.num}" loading="lazy" class="w-full h-full object-cover" />
                  <span class="absolute top-1.5 left-1.5 bg-black/75 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow">Pose ${p.num}</span>
                </div>
                <a href="${p.url}" download="photobooth_pose_${p.num}.jpg" class="py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-center text-xs font-bold text-white active:scale-95 transition-all shadow">
                  Unduh Pose ${p.num} (HD)
                </a>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
        `
            : ''
        }

        <footer class="text-center text-gray-500 text-xs mt-4">
          Powered by Professional DSLR Photobooth Engine
        </footer>
      </div>

      <script>
        function switchStripView(mode) {
          const img = document.getElementById('preview-strip-img');
          const btnFull = document.getElementById('btn-tab-full');
          const btnSingle = document.getElementById('btn-tab-single');
          if (!img || !btnFull || !btnSingle) return;
          if (mode === 'full') {
            img.src = '${printImgUrl}';
            btnFull.className = 'flex-1 py-2 rounded-lg transition-all bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md';
            btnSingle.className = 'flex-1 py-2 rounded-lg transition-all text-gray-400 hover:text-white';
          } else {
            img.src = '${stripImgUrl}';
            btnSingle.className = 'flex-1 py-2 rounded-lg transition-all bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md';
            btnFull.className = 'flex-1 py-2 rounded-lg transition-all text-gray-400 hover:text-white';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Generate QR Code for active session
app.get('/api/qr/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const localIp = getLocalIp();
  const shareUrl = `http://${localIp}:${PORT}/share/${sessionId}`;

  try {
    const qrDataUri = await qrcode.toDataURL(shareUrl, {
      margin: 1,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    res.json({ url: shareUrl, qrDataUri });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io real-time connection
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Send current state immediately upon connection
  socket.emit('session:state', {
    session: sessionManager.getCurrentSession(),
    state: sessionManager.getBoothState(),
    countdown: 0,
  });

  socket.on('session:start', async () => {
    await sessionManager.startNewSession();
  });

  socket.on('session:selectTemplate', (templateId: string) => {
    sessionManager.selectTemplate(templateId);
  });

  socket.on('session:readyLiveView', async () => {
    await sessionManager.proceedToLiveView();
  });

  socket.on('session:startCountdown', () => {
    sessionManager.startUserCountdown();
  });

  socket.on('session:retake', async () => {
    await sessionManager.retakeCurrentPose();
  });

  socket.on('session:acceptPose', async () => {
    await sessionManager.acceptPoseAndContinue();
  });

  socket.on('session:applyFilter', async (filter) => {
    await sessionManager.applyFilter(filter);
  });

  socket.on('session:print', async (data: { copies: number }) => {
    const result = await sessionManager.printCollage(data?.copies || 1);
    socket.emit('session:print_result', result);
  });

  socket.on('session:done', () => {
    sessionManager.resetToIdle();
  });

  // Payment triggers
  socket.on('payment:simulateSuccess', () => {
    paymentManager.simulateSandboxSuccess();
  });

  socket.on('payment:applyVoucher', async (code: string) => {
    await sessionManager.applyVoucherCode(code);
  });

  socket.on('admin:reprintSession', async (sessionId: string) => {
    const sessionPrintPath = path.resolve(__dirname, `../../output/sessions/${sessionId}/print_4x6_2up.jpg`);
    if (fs.existsSync(sessionPrintPath)) {
      const res = await printerService.print(sessionPrintPath, 1);
      socket.emit('admin:reprint_result', { sessionId, ...res });
    } else {
      socket.emit('admin:reprint_result', { sessionId, success: false, message: 'Print file not found' });
    }
  });

  // Admin triggers
  socket.on('admin:setCameraProvider', (provider: 'mock' | 'gphoto2' | 'edsdk') => {
    cameraManager.setProvider(provider);
    socket.emit('admin:cameraStatus', { provider });
  });

  socket.on('admin:testPrint', async () => {
    const samplePrint = path.resolve(__dirname, '../../public/templates/1.png');
    const res = await printerService.print(samplePrint, 1);
    socket.emit('admin:testPrint_result', res);
  });

  socket.on('admin:testShot', async () => {
    try {
      const testDir = path.resolve(__dirname, '../../output');
      fs.mkdirSync(testDir, { recursive: true });
      const testPath = path.join(testDir, 'test_shot.jpg');
      const res = await cameraManager.capturePhoto(testPath);
      socket.emit('admin:testShot_result', res);
    } catch (err: any) {
      socket.emit('admin:testShot_result', { error: err?.message || 'Capture failed' });
    }
  });

  socket.on('admin:setPrinterDryRun', (dryRun: boolean) => {
    printerService.setDryRun(dryRun);
    socket.emit('admin:printerStatus', printerService.getStatus());
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

export function startServer(port = PORT): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\n========================================`);
      console.log(`📸 Photobooth Server running on:`);
      console.log(`👉 Local:   http://localhost:${port}`);
      console.log(`👉 Network: http://${getLocalIp()}:${port}`);
      console.log(`========================================\n`);
      cameraManager.initialize().then((health) => {
        console.log(`[Camera] Initialized: ${health.model} (Connected: ${health.connected})`);
      });
      resolve();
    });
  });
}

if (require.main === module) {
  startServer();
}
