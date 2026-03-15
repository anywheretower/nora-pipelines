/**
 * NORA — Imagen a Imagen (Qwen Image Edit 2511)
 * Genera imagen editada vía ComfyUI remoto (PC-2), sube a Supabase Storage, actualiza registro.
 *
 * Uso: node comfy-img2img.mjs [--once] [--id=123] [--max=4]
 *   --once    Procesa lo pendiente y sale (no hace polling)
 *   --id=123  Procesa solo esa creatividad
 *   --max=N   Máximo N imágenes por corrida (default: 4, por VRAM leak)
 */

// --- Load .env from project root ---
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
} catch { /* .env not found, rely on existing env vars */ }

const COMFY = process.env.COMFY_URL || 'http://192.168.1.26:8188';
const SUPA = process.env.SUPABASE_URL || 'https://fddokyfilokacsjdgiwe.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZG9reWZpbG9rYWNzamRnaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTc2MDEsImV4cCI6MjA4NTE3MzYwMX0._lY8wLKQ6pudUOp6pKX71YJ9bmwsAaoU794cqJNbdHc';
const POLL_INTERVAL = 30000;
const COMFY_POLL = 3000;

const IMG2IMG_ORIGENES = ['Producto', 'Colaborador', 'Interior', 'Exterior', 'Fachada'];

const NEGATIVE_PROMPT = "texto, text, letters, words, logos, watermark, marca de agua, overlay, banner, subtitles, subtítulos, artefactos, distorsiones, duplicated face, duplicate person, extra limbs, deformed hands, low quality, blurry";

const supaHeaders = {
  'Authorization': `Bearer ${KEY}`,
  'apikey': KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// --- Parse args ---
const args = process.argv.slice(2);
const once = args.includes('--once');
const idArg = args.find(a => a.startsWith('--id='));
const onlyId = idArg ? parseInt(idArg.split('=')[1]) : null;
const maxArg = args.find(a => a.startsWith('--max='));
const MAX_PER_RUN = maxArg ? parseInt(maxArg.split('=')[1]) : 4; // VRAM leak safety

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CL', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function randomSeed() {
  const min = 100000000000000;
  const max = 999999999999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildWorkflow(prompt, imageUrl, seed) {
  return {
    prompt: {
      "60": {
        inputs: { filename_prefix: "nora-i2i", images: ["107", 0] },
        class_type: "SaveImage",
        _meta: { title: "Save Image" }
      },
      "103": {
        inputs: { vae_name: "qwen_image_vae.safetensors" },
        class_type: "VAELoader",
        _meta: { title: "Load VAE" }
      },
      "104": {
        inputs: {
          prompt: NEGATIVE_PROMPT,
          clip: ["108", 0],
          vae: ["103", 0],
          image: ["141", 0]
        },
        class_type: "TextEncodeQwenImageEdit",
        _meta: { title: "TextEncodeQwenImageEdit" }
      },
      "105": {
        inputs: { strength: 1, model: ["106", 0] },
        class_type: "CFGNorm",
        _meta: { title: "CFGNorm" }
      },
      "106": {
        inputs: { shift: 3, model: ["111", 0] },
        class_type: "ModelSamplingAuraFlow",
        _meta: { title: "ModelSamplingAuraFlow" }
      },
      "107": {
        inputs: { samples: ["112", 0], vae: ["103", 0] },
        class_type: "VAEDecode",
        _meta: { title: "VAE Decode" }
      },
      "108": {
        inputs: { clip_name: "qwen_2.5_vl_7b_fp8_scaled.safetensors", type: "qwen_image", device: "default" },
        class_type: "CLIPLoader",
        _meta: { title: "Load CLIP" }
      },
      "109": {
        inputs: { pixels: ["141", 0], vae: ["103", 0] },
        class_type: "VAEEncode",
        _meta: { title: "VAE Encode" }
      },
      "111": {
        inputs: { lora_name: "Qwen-Image-Edit-Lightning-4steps-V1.0-bf16.safetensors", strength_model: 1, model: ["114", 0] },
        class_type: "LoraLoaderModelOnly",
        _meta: { title: "LoraLoaderModelOnly" }
      },
      "112": {
        inputs: {
          seed, steps: 4, cfg: 1,
          sampler_name: "euler", scheduler: "simple", denoise: 1,
          model: ["105", 0], positive: ["113", 0], negative: ["104", 0],
          latent_image: ["109", 0]
        },
        class_type: "KSampler",
        _meta: { title: "KSampler" }
      },
      "113": {
        inputs: {
          prompt,
          clip: ["108", 0],
          vae: ["103", 0],
          image: ["141", 0]
        },
        class_type: "TextEncodeQwenImageEdit",
        _meta: { title: "TextEncodeQwenImageEdit" }
      },
      "114": {
        inputs: { unet_name: "qwen_image_edit_fp8_e4m3fn.safetensors", weight_dtype: "default" },
        class_type: "UNETLoader",
        _meta: { title: "Load Diffusion Model" }
      },
      "141": {
        inputs: { url_or_path: imageUrl },
        class_type: "LoadImageFromUrlOrPath",
        _meta: { title: "Load Image" }
      }
    },
    client_id: "nora-i2i"
  };
}

async function getPendingCreatividades() {
  let url;
  if (onlyId) {
    url = `${SUPA}/rest/v1/creatividades?id=eq.${onlyId}&origen=in.(${IMG2IMG_ORIGENES.join(',')})&select=id,prompt,marca,url,estado,origen`;
  } else {
    url = `${SUPA}/rest/v1/creatividades?estado=eq.para_ejecucion&origen=in.(${IMG2IMG_ORIGENES.join(',')})&prompt=not.is.null&url=not.is.null&select=id,prompt,marca,url,estado,origen&order=id.asc`;
  }
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${KEY}`, 'apikey': KEY } });
  const data = await r.json();
  return data.filter(c => c.prompt && c.prompt.trim().length > 0 && c.url);
}

async function queuePrompt(workflow) {
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow)
  });
  const data = await r.json();
  if (data.error) throw new Error(`ComfyUI error: ${JSON.stringify(data.error)}`);
  return data.prompt_id;
}

async function waitForCompletion(promptId, maxWait = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, COMFY_POLL));
    try {
      const r = await fetch(`${COMFY}/history/${promptId}`);
      const history = await r.json();
      const entry = history[promptId];
      if (!entry) continue;

      if (entry.status?.status_str === 'error') {
        throw new Error(`ComfyUI execution error: ${JSON.stringify(entry.status)}`);
      }

      const outputs = entry.outputs;
      if (outputs) {
        // SaveImage node is "60" in img2img workflow
        const saveNode = outputs["60"];
        if (saveNode && saveNode.images && saveNode.images.length > 0) {
          const img = saveNode.images[0];
          return { filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' };
        }
      }
    } catch (e) {
      if (e.message.includes('ComfyUI execution error')) throw e;
    }
  }
  throw new Error(`Timeout waiting for ComfyUI completion (${maxWait / 1000}s)`);
}

async function downloadImage(filename, subfolder, type) {
  const params = new URLSearchParams({ filename, type });
  if (subfolder) params.set('subfolder', subfolder);
  const r = await fetch(`${COMFY}/view?${params}`);
  if (!r.ok) throw new Error(`Download failed: ${r.status} ${r.statusText}`);
  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadToSupabase(imageBuffer, marca) {
  const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const name = `${safeMarca}_i2i_${Date.now()}.png`;
  const r = await fetch(`${SUPA}/storage/v1/object/creatividades/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'apikey': ANON,
      'Content-Type': 'image/png'
    },
    body: imageBuffer
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Upload failed: ${r.status} ${err}`);
  }
  const data = await r.json();
  return `${SUPA}/storage/v1/object/public/${data.Key}`;
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
        observacion: `[auto] ${errorMsg.substring(0, 500)}`
      })
    });
  } catch { /* best effort */ }
}

async function updateCreatividad(id, imageUrl) {
  const r = await fetch(`${SUPA}/rest/v1/creatividades?id=eq.${id}`, {
    method: 'PATCH',
    headers: supaHeaders,
    body: JSON.stringify({
      estado: 'ejecutado',
      link_ren_1: imageUrl,
      condicion: 'para_revision'
    })
  });
  if (r.status !== 204) throw new Error(`Update failed: ${r.status}`);
}

async function processOne(creatividad) {
  const { id, prompt, marca, url, origen } = creatividad;
  log(`▶ #${id} [${marca}] [${origen}] — Generando imagen...`);

  // Mark as processing to prevent duplicate pickup
  await markAsProcessing(id);

  const seed = randomSeed();
  const workflow = buildWorkflow(prompt, url, seed);

  const promptId = await queuePrompt(workflow);
  log(`  ⏳ Queued (${promptId.substring(0, 8)}...) seed=${seed}`);

  const imageInfo = await waitForCompletion(promptId);
  log(`  ✅ Generada: ${imageInfo.filename}`);

  const imageBuffer = await downloadImage(imageInfo.filename, imageInfo.subfolder, imageInfo.type);
  log(`  📥 Descargada (${(imageBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  const imageUrl = await uploadToSupabase(imageBuffer, marca);
  log(`  ☁️ Subida: ${imageUrl.split('/').pop()}`);

  await updateCreatividad(id, imageUrl);
  log(`  ✅ #${id} → para_revision`);
  stats.ok++;

  return imageUrl;
}

const stats = { ok: 0, fail: 0 };

async function run() {
  log('🚀 NORA Image-to-Image (Qwen Edit) — Iniciando');

  // Check ComfyUI is alive
  try {
    const r = await fetch(`${COMFY}/system_stats`, { signal: AbortSignal.timeout(5000) });
    const sysStats = await r.json();
    log(`ComfyUI v${sysStats.system.comfyui_version} — ${sysStats.devices[0].name.split(':')[1].trim()}`);
  } catch (e) {
    log('❌ ComfyUI no responde en ' + COMFY);
    log('');
    log('   Posibles causas:');
    log('   1. PC-2 está apagada → encender PC-2');
    log('   2. ComfyUI no está corriendo → ejecutar run_nvidia_gpu_network.bat en PC-2');
    log('   3. IP cambió → verificar IP de PC-2 y actualizar COMFY_URL en .env');
    log('');
    log('   Una vez ComfyUI esté corriendo, re-ejecutar:');
    log(`   node ${process.argv[1]} ${process.argv.slice(2).join(' ')}`);
    process.exit(1);
  }

  if (!KEY) {
    log('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
    log('   Verificar nora-pipelines/.env o exportar la variable de entorno');
    process.exit(1);
  }

  let keepGoing = true;
  while (keepGoing) {
    let pending;
    try {
      pending = await getPendingCreatividades();
    } catch (e) {
      log(`❌ Error consultando Supabase: ${e.message}`);
      if (once || onlyId) break;
      log('  ⏸ Reintentando en 30s...');
      await new Promise(r => setTimeout(r, 30000));
      continue;
    }

    if (pending.length === 0) {
      if (once || onlyId) {
        log('Sin creatividades img2img pendientes. Saliendo.');
        break;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    const c = pending[0];
    log(`📋 ${pending.length} pendiente(s) — Procesando #${c.id} [${c.marca}] [${c.origen}]`);

    try {
      await processOne(c);
    } catch (e) {
      log(`❌ #${c.id} Error: ${e.message}`);
      await markAsError(c.id, e.message);
      log(`  ⚠️ #${c.id} → estado=error`);
      stats.fail++;
    }

    // Límite por corrida: máx 4 imágenes (VRAM leak en ComfyUI)
    if (stats.ok + stats.fail >= MAX_PER_RUN) {
      log(`🛑 Límite de ${MAX_PER_RUN} imágenes por corrida alcanzado.`);
      break;
    }

    // Pausa de 5s entre imágenes para dejar que ComfyUI se estabilice
    if (!once || pending.length > 1) {
      log('  ⏸ 5s antes de la siguiente...');
      await new Promise(r => setTimeout(r, 5000));
    }

    if (onlyId) break;
  }

  log(`👋 Fin — ✅ ${stats.ok} generadas, ❌ ${stats.fail} fallidas`);
}

process.on('uncaughtException', (e) => { log(`💥 UNCAUGHT: ${e.message}\n${e.stack}`); });
process.on('unhandledRejection', (e) => { log(`💥 UNHANDLED REJECTION: ${e?.message || e}\n${e?.stack || ''}`); });

run().catch(e => { log(`💥 RUN ERROR: ${e.message}\n${e.stack}`); process.exit(1); });
