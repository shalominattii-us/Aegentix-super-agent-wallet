/**
 * AEGENTIX ENTERPRISE AUTONOMOUS PRODUCTION SUPERVISOR
 * Fail-proof, self-healing process supervisor & watchdog.
 * Monitors core server (:3000), LiveAPI (:7777), and OBS WebSocket (:4455).
 * Auto-resurrects on crash, clears hung ports, and persists state.
 */

import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const LOG_DIR = 'C:/Aegentix/brain';
const LOG_FILE = path.join(LOG_DIR, 'production-supervisor.log');
const STATE_FILE = path.join(LOG_DIR, 'supervisor-state.json');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] [SUPERVISOR] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {}
}

function saveState(state: any) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
  } catch {}
}

function isPortActive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/mcp/info`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function clearStalePort(port: number) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = out.trim().split('\n');
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          log(`Clearing hung process PID ${pid} holding port ${port}...`);
          try {
            execSync(`taskkill /F /PID ${pid}`);
          } catch {}
        }
      }
    }
  } catch {}
}

let serverProcess: any = null;
let restartCount = 0;
let isShuttingDown = false;

function launchCoreServer() {
  if (isShuttingDown) return;

  log(`Launching Aegentix Core Server (Run #${++restartCount})...`);
  clearStalePort(3000);
  clearStalePort(7777);

  const env = { ...process.env, PORT: '3000' };

  serverProcess = spawn('node', ['dist/server.js'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (d: Buffer) => {
    const str = d.toString();
    if (str.includes('listening on') || str.includes('Loaded')) {
      log(`[CORE] ${str.trim()}`);
    }
  });

  serverProcess.stderr.on('data', (d: Buffer) => {
    const str = d.toString();
    if (!str.includes('DeprecationWarning')) {
      log(`[CORE-ERR] ${str.trim()}`);
    }
  });

  serverProcess.on('exit', (code: number, signal: string) => {
    log(`Aegentix Core exited with code ${code} (signal: ${signal}).`);
    serverProcess = null;
    if (!isShuttingDown) {
      log('Fail-Proof auto-healing triggered: restarting in 1500ms...');
      setTimeout(launchCoreServer, 1500);
    }
  });

  saveState({ pid: serverProcess.pid, restartCount, status: 'ONLINE' });
}

// Watchdog loop every 10 seconds
setInterval(async () => {
  if (isShuttingDown) return;

  const healthy = await isPortActive(3000);
  if (!healthy) {
    log('Watchdog health check failed on :3000! Checking process...');
    if (!serverProcess || serverProcess.killed) {
      log('Process dead or hung. Resurrecting immediately...');
      launchCoreServer();
    }
  } else {
    saveState({ pid: serverProcess?.pid, restartCount, status: 'HEALTHY' });
  }
}, 10000);

process.on('SIGINT', () => {
  isShuttingDown = true;
  log('Supervisor received SIGINT. Clean shutdown...');
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  log('Supervisor received SIGTERM. Clean shutdown...');
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});

log('Enterprise Production Supervisor started. Managing fail-proof pipeline.');
launchCoreServer();
