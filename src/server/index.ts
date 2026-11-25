import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import os from 'os';
import qrcode from 'qrcode';
import { SessionManager } from './sessionManager';
import { CameraManager } from './camera/cameraManager';
import { PrinterService } from './printer/printerService';
import { TemplateCompositor } from './template/compositor';

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

// REST APIs
app.get('/api/health', async (req, res) => {
  const camHealth = await cameraManager.getHealth();
  const printStatus = printerService.getStatus();
  res.json({
    status: 'ok',
    camera: camHealth,
    printer: printStatus,
    localIp: getLocalIp(),
  });
});

app.get('/api/templates', (req, res) => {
  res.json(TemplateCompositor.getAllTemplates());
});

// Mobile QR Code Landing Page for Guests
app.get('/share/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(outputDir, 'sessions', sessionId);
  const printImgUrl = `/output/sessions/${sessionId}/print_4x6_2up.jpg`;
  const stripImgUrl = `/output/sessions/${sessionId}/print_4x6_2up_strip.jpg`;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Photobooth Memories</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-950 text-white min-h-screen flex flex-col items-center p-6">
      <div class="max-w-md w-full flex flex-col items-center">
        <h1 class="text-2xl font-bold mb-2 text-rose-400">✨ Photobooth Memories</h1>
        <p class="text-gray-400 text-sm mb-6 text-center">Tap and hold on the photo or click the download button below!</p>
        
        <div class="bg-gray-900 p-3 rounded-2xl shadow-2xl border border-gray-800 mb-6">
          <img src="${stripImgUrl}" alt="Photo Strip" class="rounded-xl max-h-[60vh] object-contain shadow-lg" onerror="this.src='${printImgUrl}'" />
        </div>

        <div class="flex flex-col gap-3 w-full">
          <a href="${stripImgUrl}" download="photobooth_strip.jpg" class="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl font-bold text-center shadow-lg shadow-pink-500/20 active:scale-95 transition-all">
            📥 Download Photo Strip
          </a>
          <a href="${printImgUrl}" download="photobooth_full.jpg" class="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-center border border-gray-700 active:scale-95 transition-all">
            🖼️ Download Full 4R Collage
          </a>
        </div>
      </div>
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
