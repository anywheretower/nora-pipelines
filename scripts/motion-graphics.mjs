/**
 * NORA — Motion Graphics (Remotion en PC-2)
 * Orquesta desde Mac via SSH a PC-2:
 *   1. Pickup creatividad con origen=motion_graphics
 *   2. PATCH estado=en_proceso (mutex)
 *   3. Lee TSX 9:16 + 4:5 del JSON en `prompt`
 *   4. Copia ambos .tsx a PC-2 src/
 *   5. Registra composiciones en Root.tsx (idempotente)
 *   6. Render Remotion dual (1080×1920 + 1080×1350)
 *   7. Descarga MP4s + upload a Supabase Storage
 *   8. PATCH estado=base_lista, link_ren_2=916, link_ren_1=45, condicion=para_revision
 *   9. En cualquier fallo post-en_proceso → PATCH estado=error, observacion=[auto] msg
 *
 * Uso:
 *   node motion-graphics.mjs --once             # Procesa pendientes y sale
 *   node motion-graphics.mjs --id=3300          # Procesa solo esa creatividad
 *   node motion-graphics.mjs --max=1            # Cap por corrida (default 1)
 *   node motion-graphics.mjs --dry-run --id=N   # Genera .tsx local, no toca PC-2 ni Storage
 *
 * La creatividad debe tener:
 *   - origen: "motion_graphics"
 *   - estado: "para_ejecucion"
 *   - prompt: JSON string con { tsx_916, tsx_45, totalFrames, fps, compName? }
 *
 * Supuestos PC-2: el proyecto Remotion vive en C:\Users\conta\.openclaw\workspace\remotion-nora\
 * y la biblioteca compartida está sincronizada en src/shared/ (ver remotion-nora-shared/README.md).
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load .env ---
try {
  const envPath = join(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found */ }

const SUPA = process.env.SUPABASE_URL ?? 'https://fddokyfilokacsjdgiwe.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZG9reWZpbG9rYWNzamRnaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTc2MDEsImV4cCI6MjA4NTE3MzYwMX0._lY8wLKQ6pudUOp6pKX71YJ9bmwsAaoU794cqJNbdHc';
const SSH_HOST = process.env.SSH_HOST ?? 'conta@192.168.1.26';
const REMOTION_DIR = process.env.REMOTION_DIR ?? 'C:\\Users\\conta\\.openclaw\\workspace\\remotion-nora';
const TEMP_DIR = join(__dirname, '..', 'tmp_motion_graphics');

const supaHeaders = {
  'Authorization': `Bearer ${KEY}`,
  'apikey': KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// --- Parse args ---
const args = process.argv.slice(2);
const once = args.includes('--once');
const dryRun = args.includes('--dry-run');
const idArg = args.find(a => a.startsWith('--id='));
const onlyId = idArg ? parseInt(idArg.split('=')[1]) : null;
const maxArg = args.find(a => a.startsWith('--max='));
const MAX_PER_RUN = maxArg ? parseInt(maxArg.split('=')[1]) : 1;
const POLL_INTERVAL = 30000;

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CL', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function ssh(cmd, opts = {}) {
  const timeout = opts.timeout ?? 600000;
  const fullCmd = `ssh ${SSH_HOST} "${cmd.replace(/"/g, '\\"')}"`;
  log(`SSH: ${cmd}`);
  return execSync(fullCmd, {
    encoding: 'utf-8',
    timeout,
    maxBuffer: 50 * 1024 * 1024,
  }).trim();
}

function scp(localPath, remotePath) {
  const cmd = `scp "${localPath}" ${SSH_HOST}:"${remotePath}"`;
  log(`SCP: ${localPath} → ${remotePath}`);
  execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
}

function scpFrom(remotePath, localPath) {
  // Convert Windows backslashes → forward slashes for the remote path.
  // Without this, scp fails with "protocol error: filename does not match request"
  // (mismo patrón que postprod-ugc.mjs y otros scripts del codebase).
  const safePath = remotePath.replace(/\\/g, '/');
  const cmd = `scp ${SSH_HOST}:"${safePath}" "${localPath}"`;
  log(`SCP: ${remotePath} → ${localPath}`);
  execSync(cmd, { encoding: 'utf-8', timeout: 300000 });
}

if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

// =============================================================
// Supabase helpers
// =============================================================

async function getPendingCreatividades() {
  let url = `${SUPA}/rest/v1/creatividades?estado=eq.para_ejecucion&origen=eq.motion_graphics&prompt=not.is.null&select=id,prompt,marca,copy,slogan_headline,concepto&order=id.asc`;
  if (onlyId) {
    url = `${SUPA}/rest/v1/creatividades?id=eq.${onlyId}&origen=eq.motion_graphics&select=id,prompt,marca,copy,slogan_headline,concepto`;
  }
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${KEY}`, 'apikey': KEY } });
  if (!r.ok) throw new Error(`getPending failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.filter(c => c.prompt && c.prompt.trim().length > 0);
}

async function markAsProcessing(id) {
  const r = await fetch(`${SUPA}/rest/v1/creatividades?id=eq.${id}`, {
    method: 'PATCH',
    headers: supaHeaders,
    body: JSON.stringify({ estado: 'en_proceso' })
  });
  if (r.status !== 204) throw new Error(`Mark en_proceso failed: ${r.status}`);
}

async function markAsError(id, errorMsg) {
  try {
    await fetch(`${SUPA}/rest/v1/creatividades?id=eq.${id}`, {
      method: 'PATCH',
      headers: supaHeaders,
      body: JSON.stringify({
        estado: 'error',
        observacion: `[auto] ${String(errorMsg).substring(0, 500)}`
      })
    });
  } catch { /* best effort */ }
}

async function markAsDone(id, url916, url45) {
  const r = await fetch(`${SUPA}/rest/v1/creatividades?id=eq.${id}`, {
    method: 'PATCH',
    headers: supaHeaders,
    body: JSON.stringify({
      estado: 'base_lista',
      link_ren_2: url916,   // 9:16 (vertical)
      link_ren_1: url45,    // 4:5 (feed)
      condicion: 'para_revision'
    })
  });
  if (r.status !== 204) throw new Error(`Mark base_lista failed: ${r.status}`);
}

// =============================================================
// Storage upload (mismo patrón que postprod-ugc.mjs)
// =============================================================

async function uploadToStorage(localPath, storageName) {
  log(`Uploading ${storageName}...`);
  const fileBuffer = readFileSync(localPath);
  const res = await fetch(
    `${SUPA}/storage/v1/object/creatividades/${storageName}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'apikey': ANON,
        'Content-Type': 'video/mp4',
        'x-upsert': 'true',
      },
      body: fileBuffer,
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Storage upload failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return `${SUPA}/storage/v1/object/public/${data.Key}`;
}

// =============================================================
// Composition spec parser
// =============================================================

function parseSpec(promptString, fallbackMarca, fallbackId) {
  let spec;
  try {
    spec = JSON.parse(promptString);
  } catch (e) {
    throw new Error(`prompt no es JSON válido: ${e.message}`);
  }
  if (!spec.tsx_916 || !spec.tsx_45) {
    throw new Error('prompt JSON debe incluir tsx_916 y tsx_45 (strings con el código TSX completo)');
  }
  if (!spec.totalFrames || !Number.isFinite(spec.totalFrames)) {
    throw new Error('prompt JSON debe incluir totalFrames (número)');
  }
  const fps = spec.fps ?? 30;
  // compName must satisfy BOTH: JS identifier (no `-`, no spaces) AND Remotion id regex (a-zA-Z0-9-, no `_`).
  // Intersection = letters + numbers only. No `_`, no `-`.
  const slug = (fallbackMarca || 'marca').toLowerCase().replace(/[^a-z0-9]/g, '');
  const compName = spec.compName || `${slug}MG${fallbackId}`;
  if (!/^[a-zA-Z0-9]+$/.test(compName)) {
    throw new Error(`compName inválido: "${compName}". Debe ser solo letras + números (sin _, -, espacios). Remotion id regex no acepta _.`);
  }
  return { ...spec, fps, compName };
}

// =============================================================
// Root.tsx idempotent patcher
// =============================================================

function patchRootTsx(rootContent, compName, totalFrames, fps) {
  if (rootContent.includes(`id="${compName}"`)) {
    log(`Root.tsx ya contiene ${compName} — skip`);
    return null;
  }
  const importLine916 = `import { ${compName} } from "./${compName}";`;
  const importLineFeed = `import { ${compName}Feed } from "./${compName}Feed";`;

  const compBlock916 = `      <Composition
        id="${compName}"
        component={${compName}}
        durationInFrames={${totalFrames}}
        fps={${fps}}
        width={1080}
        height={1920}
      />`;
  const compBlockFeed = `      <Composition
        id="${compName}Feed"
        component={${compName}Feed}
        durationInFrames={${totalFrames}}
        fps={${fps}}
        width={1080}
        height={1350}
      />`;

  const lastImportIdx = rootContent.lastIndexOf('import ');
  const afterLastImport = rootContent.indexOf('\n', lastImportIdx);
  let newRoot = rootContent.slice(0, afterLastImport + 1)
    + importLine916 + '\n'
    + importLineFeed + '\n'
    + rootContent.slice(afterLastImport + 1);

  const closingTag = newRoot.lastIndexOf('</>');
  if (closingTag === -1) throw new Error('Root.tsx: no se encontró cierre </> para insertar composiciones');
  newRoot = newRoot.slice(0, closingTag)
    + compBlock916 + '\n'
    + compBlockFeed + '\n'
    + newRoot.slice(closingTag);
  return newRoot;
}

// =============================================================
// Pipeline principal por creatividad
// =============================================================

async function processCreatividad(crea) {
  const id = crea.id;
  const marca = crea.marca || 'marca';
  log(`▶ Procesando #${id} (${marca})`);

  const spec = parseSpec(crea.prompt, marca, id);
  const { tsx_916, tsx_45, totalFrames, fps, compName } = spec;
  log(`  compName=${compName} totalFrames=${totalFrames} fps=${fps}`);

  // Escribir TSX local
  const tsx916Path = join(TEMP_DIR, `${compName}.tsx`);
  const tsx45Path = join(TEMP_DIR, `${compName}Feed.tsx`);
  writeFileSync(tsx916Path, tsx_916, 'utf-8');
  writeFileSync(tsx45Path, tsx_45, 'utf-8');
  log(`  TSX local: ${tsx916Path}, ${tsx45Path}`);

  if (dryRun) {
    log(`  [dry-run] no toco PC-2 ni Storage. Revisar archivos locales.`);
    return { id, dryRun: true };
  }

  // Mutex
  await markAsProcessing(id);

  // Copia a PC-2
  scp(tsx916Path, `${REMOTION_DIR}\\src\\${compName}.tsx`);
  scp(tsx45Path, `${REMOTION_DIR}\\src\\${compName}Feed.tsx`);

  // Patch Root.tsx idempotente
  const rootContent = ssh(`type "${REMOTION_DIR}\\src\\Root.tsx"`);
  const newRoot = patchRootTsx(rootContent, compName, totalFrames, fps);
  if (newRoot) {
    const rootTmp = join(TEMP_DIR, `Root_${id}.tsx`);
    writeFileSync(rootTmp, newRoot, 'utf-8');
    scp(rootTmp, `${REMOTION_DIR}\\src\\Root.tsx`);
    try { unlinkSync(rootTmp); } catch {}
    log('  Root.tsx actualizado');
  }

  // Render dual
  log(`  Render ${compName} (1080×1920)...`);
  ssh(
    `cd /d "${REMOTION_DIR}" && npx remotion render src/index.ts ${compName} out/${compName}.mp4`,
    { timeout: 900000 }
  );
  log(`  Render ${compName}Feed (1080×1350)...`);
  ssh(
    `cd /d "${REMOTION_DIR}" && npx remotion render src/index.ts ${compName}Feed out/${compName}Feed.mp4`,
    { timeout: 900000 }
  );

  // Descarga
  const local916 = join(TEMP_DIR, `${compName}.mp4`);
  const local45 = join(TEMP_DIR, `${compName}Feed.mp4`);
  scpFrom(`${REMOTION_DIR}\\out\\${compName}.mp4`, local916);
  scpFrom(`${REMOTION_DIR}\\out\\${compName}Feed.mp4`, local45);

  // Upload Storage
  const slug = marca.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const ts = Date.now();
  const url916 = await uploadToStorage(local916, `${slug}_motion_graphics_${id}_916_${ts}.mp4`);
  const url45 = await uploadToStorage(local45, `${slug}_motion_graphics_${id}_45_${ts}.mp4`);

  // PATCH base_lista
  await markAsDone(id, url916, url45);

  // Cleanup local
  try { unlinkSync(tsx916Path); } catch {}
  try { unlinkSync(tsx45Path); } catch {}
  try { unlinkSync(local916); } catch {}
  try { unlinkSync(local45); } catch {}

  log(`✓ #${id} listo. 9:16=${url916}  4:5=${url45}`);
  return { id, url916, url45 };
}

// =============================================================
// Loop principal
// =============================================================

async function main() {
  log('=== motion-graphics.mjs ===');
  log(`SUPA=${SUPA}  SSH_HOST=${SSH_HOST}  REMOTION_DIR=${REMOTION_DIR}`);
  log(`once=${once} onlyId=${onlyId ?? '-'} max=${MAX_PER_RUN} dryRun=${dryRun}`);
  if (!KEY && !dryRun) throw new Error('SUPABASE_SERVICE_ROLE_KEY no definido en .env');

  const stats = { ok: 0, fail: 0 };
  while (true) {
    const pending = await getPendingCreatividades();
    if (pending.length === 0) {
      if (once || onlyId) {
        log('Sin pendientes. Salgo.');
        break;
      }
      log(`Sin pendientes. Esperando ${POLL_INTERVAL / 1000}s...`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }
    log(`Pendientes: ${pending.length}`);

    for (const crea of pending) {
      try {
        await processCreatividad(crea);
        stats.ok++;
      } catch (e) {
        stats.fail++;
        log(`  ✗ #${crea.id} → estado=error: ${e.message}`);
        await markAsError(crea.id, e.message);
      }
      if (stats.ok + stats.fail >= MAX_PER_RUN) {
        log(`🛑 Límite de ${MAX_PER_RUN} por corrida alcanzado.`);
        break;
      }
    }

    if (once || onlyId || (stats.ok + stats.fail >= MAX_PER_RUN)) break;
  }

  log(`=== Fin. ok=${stats.ok} fail=${stats.fail} ===`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
