import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import { nexusRegistry } from '../nexus/nexusRegistryEngine.ts';

const execAsync = util.promisify(exec);

export const grokMcpRouter = Router();

// Store active SSE client streams by sessionId
const activeSessions = new Map<string, { res: Response; createdAt: number }>();

// Clean up stale sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.createdAt > 3600000) {
      try {
        session.res.end();
      } catch {}
      activeSessions.delete(id);
    }
  }
}, 600000);

const BRAIN_DIR = 'C:/Aegentix/brain';

function mcpAuthToken(): string {
  return (process.env.GROK_CONNECTOR_TOKEN || process.env.GROK_API_KEY || '').trim();
}

function isAuthorized(req: Request): boolean {
  const validToken = mcpAuthToken();
  if (!validToken) {
    return false;
  }
  const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const xApiKey = ((req.headers['x-api-key'] as string) || '').trim();
  const queryToken = ((req.query.token as string) || (req.query.key as string) || '').trim();

  return (
    authHeader === validToken ||
    xApiKey === validToken ||
    queryToken === validToken
  );
}

function readFileSafe(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (e: any) {
    return `[Error reading ${filePath}: ${e.message}]`;
  }
  return '[File not found]';
}

// -------------------------------------------------------------
// MCP TOOL DEFINITIONS (DEVICE-WIDE UNRESTRICTED)
// -------------------------------------------------------------
const MCP_TOOLS = [
  // --- SYSTEM-WIDE HOST TOOLS ---
  {
    name: 'execute_system_command',
    description: 'Executes ANY shell command (PowerShell or CMD) on the physical Windows device with full system privileges. Returns stdout, stderr, and exit status.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The exact command to run (e.g. dir, git status, npm run build, Get-Process, python, curl)'
        },
        cwd: {
          type: 'string',
          description: 'Working directory path (optional, defaults to project root)'
        },
        shell: {
          type: 'string',
          enum: ['powershell', 'cmd'],
          description: 'Shell execution environment (default: powershell)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'read_system_file',
    description: 'Reads the entire content of ANY file anywhere on the device (supports absolute Windows paths e.g. C:\\... or relative paths).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Full path or relative path to file'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'write_system_file',
    description: 'Writes, creates, or updates ANY file anywhere on the device with text content.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Target path to write file'
        },
        content: {
          type: 'string',
          description: 'Content to write into file'
        }
      },
      required: ['filePath', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'Lists all files, subdirectories, sizes, and modification timestamps in ANY folder on the device.',
    inputSchema: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: 'Target folder path (e.g. C:\\Users\\eagle\\antigravity\\Aegentix-Super-Agent-Wallet, C:\\Aegentix)'
        }
      },
      required: ['dirPath']
    }
  },

  // --- SOVEREIGN OS & PINNACLE DOMAIN TOOLS ---
  {
    name: 'get_production_dossier',
    description: 'Retrieves the complete, consolidated Aegentix Sovereign OS & Pinnacle Derivatives production dossier with architecture, covenants, and live disk state.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_medical_recruiter_overview',
    description: 'Retrieves the live HIPAA-decoupled Medical Recruiter ledger overview, including total vault escrow, active contractor contracts, and available streaming payroll balances.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'draw_medical_stream',
    description: 'Executes an instant streaming payroll draw for an active healthcare contractor. Deducts available stream balance, chains a cryptographic audit record, and executes settlement over FedNow.',
    inputSchema: {
      type: 'object',
      properties: {
        contractorId: { type: 'string', description: 'Contractor ID (e.g. CONT-MED-001)' },
        drawAmountUsd: { type: 'number', description: 'Amount in USD to draw' },
        memo: { type: 'string', description: 'Disbursement reference note' }
      },
      required: ['contractorId', 'drawAmountUsd']
    }
  },
  {
    name: 'adjudicate_medical_claims',
    description: 'Adjudicates a batch of institutional hospital claims against the TSL zero-trust escrow reserve, disbursing immediate liquidity to staffing contractors.',
    inputSchema: {
      type: 'object',
      properties: {
        batchId: { type: 'string', description: 'Batch identifier' },
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              claimId: { type: 'string' },
              providerHospital: { type: 'string' },
              claimAmountUsd: { type: 'number' }
            },
            required: ['claimId', 'claimAmountUsd']
          }
        }
      },
      required: ['claims']
    }
  },
  {
    name: 'mint_medical_contractor',
    description: 'Mints a sovereign contractor NFT with NPI credential verification, malpractice insurance attestation, and streaming payroll rate configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        contractorName: { type: 'string', description: 'Full legal name with credentials' },
        role: { type: 'string', description: 'Specialty or role' },
        npiNumber: { type: 'string', description: '10-digit NPI' },
        hourlyStreamingRateUsd: { type: 'number', description: 'Hourly streaming rate' },
        initialEscrowAllocationUsd: { type: 'number', description: 'Initial escrow reserved' }
      },
      required: ['contractorName', 'role', 'npiNumber', 'hourlyStreamingRateUsd']
    }
  },
  {
    name: 'get_pinnacle_overview',
    description: 'Retrieves the Pinnacle Derivatives LLC corporate overview, $62.5M Vault Escrow custody state, 29 US federal venue connections, and SEC/CFTC/FinCEN compliance classification.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'simulate_pinnacle_growth',
    description: 'Computes a multi-month delta-neutral basis arbitrage growth simulation for any of the 25 US industries and 125 benchmark enterprises.',
    inputSchema: {
      type: 'object',
      properties: {
        industryId: { type: 'string', description: 'Target industry ID' },
        principalUsd: { type: 'number', description: 'Starting capital' },
        months: { type: 'number', description: 'Months horizon' },
        leverage: { type: 'number', description: 'Leverage multiplier' }
      },
      required: ['industryId', 'principalUsd']
    }
  },
  {
    name: 'onboard_pinnacle_institution',
    description: 'Onboards an institutional counterparty with anti-human-trafficking covenant attestation, cryptographic SHA-256 covenant signing, and dedicated channel allocation.',
    inputSchema: {
      type: 'object',
      properties: {
        institutionName: { type: 'string', description: 'Legal name of firm' },
        jurisdiction: { type: 'string', description: 'Jurisdiction' },
        allocationUsd: { type: 'number', description: 'Capital allocation' },
        tier: { type: 'string', enum: ['TIER_2_COMMERCIAL_B2B', 'TIER_3_INSTITUTIONAL_PRIME'] },
        covenantConsent: { type: 'boolean', description: 'Covenant attestation' }
      },
      required: ['institutionName', 'allocationUsd', 'covenantConsent']
    }
  },

  // --- NEXUS SKILL REGISTRY TOOLS (2,710+ SKILLS) ---
  {
    name: 'nexus_search_skills',
    description: 'Searches across the 2,710+ agent skills in the Nexus Registry by keyword, category, or tag.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term (e.g. trading, defi, security, reasoning, react, python)' },
        category: { type: 'string', description: 'Category filter (optional)' },
        limit: { type: 'number', description: 'Maximum results to return (default: 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'nexus_get_skill_info',
    description: 'Retrieves full details, manifest, and SKILL.md specification for any skill in the Nexus Registry.',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'Unique skill ID (e.g. quant-analyst, defi-amm-security)' }
      },
      required: ['skillId']
    }
  },
  {
    name: 'nexus_install_skill',
    description: 'Installs and binds any skill from the Nexus Registry into Aegentix Sovereign OS (.agents/skills).',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'Unique skill ID to install' }
      },
      required: ['skillId']
    }
  },
  {
    name: 'nexus_execute_command',
    description: 'Executes a Nexus Registry Command Protocol (NRCP) command string (e.g. nexus search trading, nexus stats, nexus install <id>).',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The nexus command string to execute' }
      },
      required: ['command']
    }
  }
];

// -------------------------------------------------------------
// TOOL EXECUTION HANDLER
// -------------------------------------------------------------
async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  const localPort = process.env.PORT || 3000;
  const baseUrl = `http://127.0.0.1:${localPort}`;

  switch (name) {
    // 1. UNRESTRICTED SYSTEM COMMAND EXECUTION
    case 'execute_system_command': {
      const command = args.command || '';
      const cwd = args.cwd ? path.resolve(args.cwd) : process.cwd();
      const isCmd = args.shell === 'cmd';
      const cmdPrefix = isCmd ? 'cmd.exe /c' : 'pwsh.exe -NoProfile -NonInteractive -Command';

      try {
        const { stdout, stderr } = await execAsync(`${cmdPrefix} ${command}`, {
          cwd,
          maxBuffer: 25 * 1024 * 1024,
          timeout: 120000
        });
        return {
          success: true,
          cwd,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        };
      } catch (err: any) {
        return {
          success: false,
          cwd,
          error: err.message,
          stdout: err.stdout?.trim() || '',
          stderr: err.stderr?.trim() || ''
        };
      }
    }

    // 2. UNRESTRICTED FILE READING
    case 'read_system_file': {
      const targetPath = path.resolve(args.filePath || '');
      if (!fs.existsSync(targetPath)) {
        return { error: `File not found: ${targetPath}` };
      }
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        return { error: `${targetPath} is a directory, not a file. Use list_directory instead.` };
      }
      const content = fs.readFileSync(targetPath, 'utf8');
      return {
        path: targetPath,
        sizeBytes: stat.size,
        content
      };
    }

    // 3. UNRESTRICTED FILE WRITING
    case 'write_system_file': {
      const targetPath = path.resolve(args.filePath || '');
      const content = args.content || '';
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, content, 'utf8');
      return {
        success: true,
        path: targetPath,
        bytesWritten: Buffer.byteLength(content, 'utf8')
      };
    }

    // 4. UNRESTRICTED DIRECTORY LISTING
    case 'list_directory': {
      const targetDir = path.resolve(args.dirPath || process.cwd());
      if (!fs.existsSync(targetDir)) {
        return { error: `Directory not found: ${targetDir}` };
      }
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const items = entries.map((e) => {
        const full = path.join(targetDir, e.name);
        try {
          const s = fs.statSync(full);
          return {
            name: e.name,
            isDirectory: e.isDirectory(),
            sizeBytes: e.isDirectory() ? 0 : s.size,
            modified: s.mtime.toISOString()
          };
        } catch {
          return { name: e.name, isDirectory: e.isDirectory(), sizeBytes: 0 };
        }
      });
      return {
        directory: targetDir,
        totalItems: items.length,
        items
      };
    }

    // 5. DOMAIN TOOLS
    case 'get_production_dossier': {
      const res = await fetch(`${baseUrl}/api/grok/dossier`);
      const text = await res.text();
      return { dossier: text };
    }

    case 'get_medical_recruiter_overview': {
      const res = await fetch(`${baseUrl}/api/aegentis/medical-recruiter/overview`);
      return await res.json();
    }

    case 'draw_medical_stream': {
      const res = await fetch(`${baseUrl}/api/aegentis/faithlines/contracts/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await res.json();
    }

    case 'adjudicate_medical_claims': {
      const res = await fetch(`${baseUrl}/api/aegentis/medical-recruiter/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await res.json();
    }

    case 'mint_medical_contractor': {
      const res = await fetch(`${baseUrl}/api/aegentis/faithlines/contracts/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await res.json();
    }

    case 'get_pinnacle_overview': {
      const res = await fetch(`${baseUrl}/api/pinnacle/overview`);
      return await res.json();
    }

    case 'simulate_pinnacle_growth': {
      const res = await fetch(`${baseUrl}/api/pinnacle/growth-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await res.json();
    }

    case 'onboard_pinnacle_institution': {
      const res = await fetch(`${baseUrl}/api/pinnacle/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      return await res.json();
    }

    // 6. NEXUS SKILL REGISTRY TOOLS
    case 'nexus_search_skills': {
      return nexusRegistry.search(args.query || '', { category: args.category, limit: args.limit || 20 });
    }

    case 'nexus_get_skill_info': {
      const skill = nexusRegistry.getSkill(args.skillId || '');
      const markdown = nexusRegistry.getSkillMarkdown(args.skillId || '');
      return { skill, markdown };
    }

    case 'nexus_install_skill': {
      return nexusRegistry.installSkill(args.skillId || '');
    }

    case 'nexus_execute_command': {
      return nexusRegistry.executeCommand(args.command || 'nexus help');
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

// -------------------------------------------------------------
// JSON-RPC 2.0 PROTOCOL DISPATCHER
// -------------------------------------------------------------
async function handleJsonRpc(reqBody: any): Promise<any> {
  const { jsonrpc, id, method, params } = reqBody;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false }
        },
        serverInfo: {
          name: 'aegentix-sovereign-os-mcp',
          version: '1.0.0',
          description: 'Sovereign OS, Pinnacle Derivatives, and Full Device Access MCP gateway.'
        }
      }
    };
  }

  if (method === 'notifications/initialized') {
    return null;
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS
      }
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    try {
      const resultData = await executeTool(toolName, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof resultData === 'string' ? resultData : JSON.stringify(resultData, null, 2)
            }
          ],
          isError: false
        }
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error executing ${toolName}: ${err.message}`
            }
          ],
          isError: true
        }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

// -------------------------------------------------------------
// EXPRESS ROUTES (PROTECTED BY YOUR GROK TOKEN)
// -------------------------------------------------------------

// Security Gatekeeper Middleware:
// Enforces that ONLY requests signed with your secret grok_... token can execute!
grokMcpRouter.use((req: Request, res: Response, next) => {
  // Allow discovery on GET /mcp and GET /mcp/info so Grok connector probe works
  if (req.method === 'GET' && (req.path === '/' || req.path === '/info')) {
    return next();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32000,
        message: 'Unauthorized. Valid grok authentication token required for device access.'
      }
    });
  }
  next();
});

// 1. Direct Stateless JSON-RPC HTTP (POST /mcp or POST /mcp/rpc)
grokMcpRouter.post(['/', '/rpc'], async (req: Request, res: Response) => {
  try {
    const responsePayload = await handleJsonRpc(req.body);
    if (!responsePayload) {
      return res.status(204).end();
    }
    return res.json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err.message }
    });
  }
});

// 2. Server-Sent Events (SSE) Endpoint (GET /mcp/sse)
grokMcpRouter.get('/sse', (req: Request, res: Response) => {
  const sessionId = crypto.randomUUID();

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.flushHeaders?.();

  activeSessions.set(sessionId, { res, createdAt: Date.now() });

  const queryToken = (req.query.token as string) || (req.query.key as string) || '';
  const tokenParam = queryToken ? `&token=${encodeURIComponent(queryToken)}` : '';
  const host = req.get('host') || '127.0.0.1:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const absoluteMessageEndpoint = `${protocol}://${host}/mcp/messages?sessionId=${sessionId}${tokenParam}`;

  // Flush keepalive comment and endpoint event per MCP SSE spec
  res.write(': keepalive\n\n');
  res.write(`event: endpoint\ndata: ${absoluteMessageEndpoint}\n\n`);

  req.on('close', () => {
    activeSessions.delete(sessionId);
  });
});

// 3. SSE Message Ingestion Endpoint (POST /mcp/messages?sessionId=...)
grokMcpRouter.post('/messages', async (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || '';
  const session = activeSessions.get(sessionId);

  try {
    const responsePayload = await handleJsonRpc(req.body);

    if (responsePayload) {
      if (session && !session.res.writableEnded) {
        session.res.write(`event: message\ndata: ${JSON.stringify(responsePayload)}\n\n`);
      }
      return res.json(responsePayload);
    }
    return res.status(202).json({ ok: true });
  } catch (err: any) {
    const errorPayload = {
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32603, message: err.message }
    };
    if (session && !session.res.writableEnded) {
      session.res.write(`event: message\ndata: ${JSON.stringify(errorPayload)}\n\n`);
    }
    return res.status(500).json(errorPayload);
  }
});

// 4. Quick Discovery / Health Check (GET /mcp or GET /mcp/info)
grokMcpRouter.get(['/', '/info'], (_req: Request, res: Response) => {
  res.json({
    status: 'ACTIVE',
    name: 'Aegentix Sovereign OS & Device Access MCP Server',
    protocol: 'Model Context Protocol (MCP) 2024-11-05',
    transportModes: ['HTTP SSE', 'Stateless JSON-RPC POST'],
    deviceAccessMode: 'UNRESTRICTED_AUTHORIZED_DEVICE_ACCESS',
    securityEnforcement: 'TOKEN_BEARER_PROTECTED',
    endpoints: {
      sse: '/mcp/sse',
      messages: '/mcp/messages',
      statelessJsonRpc: '/mcp'
    },
    toolsCount: MCP_TOOLS.length,
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description }))
  });
});
