/**
 * NORA — Multi-Angle Camera Control (Qwen Image Edit 2511 + Angles LoRA)
 * Toma una imagen existente y genera la misma escena desde un ángulo de cámara diferente.
 * Usa el LoRA de fal.ai "Multiple Angles" sobre Qwen-Image-Edit-2511 (fp8mixed).
 * Ejecutado en modo manual por la skill nora-imagen-observacion.
 *
 * Uso: node comfy-multiangle.mjs --image=<url> --angle="<sks> front view eye-level shot medium shot" [--id=123] [--seed=123]
 *   --image     Imagen de entrada (URL) — requerido
 *   --angle     Prompt de ángulo (formato <sks>) — requerido
 *   --id        ID de creatividad en Supabase (sube resultado y actualiza estado)
 *   --seed      Seed específica (default: random)
 *   --no-lightning  No usar Lightning LoRA (más steps, ~90s)
 *   --strength  Fuerza del LoRA de ángulos (default: 1.0)
 *
 * Ángulos disponibles (96 combinaciones):
 *   Azimut: front, front-right quarter, right side, back-right quarter, back, back-left quarter, left side, front-left quarter
 *   Elevación: low-angle shot (-30°), eye-level shot (0°), elevated shot (30°), high-angle shot (60°)
 *   Distancia: close-up, medium shot, wide shot
 *   Formato: <sks> [azimut] view [elevación] [distancia]
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
const COMFY_POLL = 3000;
const TG_BOT = '8150400766:AAEM2MB0KCpvWEr73AlGQ2d4r47ftpD26SQ';
const TG_CHAT = '8276003178';

// --- Parse args ---
const args = process.argv.slice(2);
const imageArg = args.find(a => a.startsWith('--image='));
const angleArg = args.find(a => a.startsWith('--angle='));
const idArg = args.find(a => a.startsWith('--id='));
const seedArg = args.find(a => a.startsWith('--seed='));
const noLightning = args.includes('--no-lightning');
const strengthArg = args.find(a => a.startsWith('--strength='));
const loraStrength = strengthArg ? parseFloat(strengthArg.split('=')[1]) : 1.0;
const stepsArg = args.find(a => a.startsWith('--steps='));

const imageUrl = imageArg ? imageArg.split('=').slice(1).join('=') : null;
const anglePrompt = angleArg ? angleArg.split('=').slice(1).join('=') : null;
const onlyId = idArg ? parseInt(idArg.split('=')[1]) : null;
const seed = seedArg ? parseInt(seedArg.split('=')[1]) : randomSeed();
const steps = stepsArg ? parseInt(stepsArg.split('=')[1]) : (noLightning ? 20 : 4);

if (!imageUrl || !anglePrompt) {
  console.error('Uso: node comfy-multiangle.mjs --image=<url> --angle="<sks> front view eye-level shot medium shot" [--id=123]');
  console.error('\nEjemplos de ángulo:');
  console.error('  "<sks> front view eye-level shot medium shot"');
  console.error('  "<sks> right side view high-angle shot close-up"');
  console.error('  "<sks> back-left quarter view low-angle shot wide shot"');
  process.exit(1);
}

// Resolution: default 1104×1472 (NORA 3:4 standard)
const IMG_W = 1104;
const IMG_H = 1472;

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CL', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function randomSeed() {
  const min = 100000000000000;
  const max = 999999999999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendTgMessage(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
    });
  } catch { /* silent */ }
}

// --- Build workflow ---
function buildWorkflow(imageUrl, anglePromptStr, seed) {
  const workflow = {
    prompt: {
      // Load image from URL (remote, no filesystem access)
      "41": {
        inputs: { url_or_path: imageUrl },
        class_type: "LoadImageFromUrlOrPath",
        _meta: { title: "Load Image" }
      },
      // Scale image to NORA 3:4 standard
      "107": {
        inputs: { image: ["41", 0], width: IMG_W, height: IMG_H, upscale_method: "lanczos", crop: "disabled" },
        class_type: "ImageScale",
        _meta: { title: "ImageScale (1104×1472)" }
      },
      // CLIP Loader
      "93": {
        inputs: {
          clip_name: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
          type: "qwen_image",
          device: "default"
        },
        class_type: "CLIPLoader",
        _meta: { title: "Load CLIP" }
      },
      // VAE Loader
      "95": {
        inputs: { vae_name: "qwen_image_vae.safetensors" },
        class_type: "VAELoader",
        _meta: { title: "Load VAE" }
      },
      // UNET Loader (fp8mixed — obligatorio para LoRAs)
      "108": {
        inputs: {
          unet_name: "qwen_image_edit_2511_fp8mixed.safetensors",
          weight_dtype: "default"
        },
        class_type: "UNETLoader",
        _meta: { title: "Load Diffusion Model" }
      },
      // LoRA 1: Multiple Angles
      "109": {
        inputs: {
          lora_name: "qwen-image-edit-2511-multiple-angles-lora.safetensors",
          strength_model: loraStrength,
          model: ["108", 0]
        },
        class_type: "LoraLoaderModelOnly",
        _meta: { title: "LoRA: Multiple Angles" }
      },
      // Positive prompt (angle) — TextEncodeQwenImageEditPlus
      "112": {
        inputs: {
          prompt: anglePromptStr,
          clip: ["93", 0],
          vae: ["95", 0],
          image1: ["107", 0]
        },
        class_type: "TextEncodeQwenImageEditPlus",
        _meta: { title: "TextEncodeQwenImageEditPlus (Positive)" }
      },
      // Negative prompt — TextEncodeQwenImageEditPlus
      "100": {
        inputs: {
          prompt: "",
          clip: ["93", 0],
          vae: ["95", 0],
          image1: ["107", 0]
        },
        class_type: "TextEncodeQwenImageEditPlus",
        _meta: { title: "TextEncodeQwenImageEditPlus (Negative)" }
      },
      // FluxKontextMultiReferenceLatentMethod (positive)
      "97": {
        inputs: {
          reference_latents_method: "index_timestep_zero",
          conditioning: ["112", 0]
        },
        class_type: "FluxKontextMultiReferenceLatentMethod",
        _meta: { title: "Multi Reference (Positive)" }
      },
      // FluxKontextMultiReferenceLatentMethod (negative)
      "96": {
        inputs: {
          reference_latents_method: "index_timestep_zero",
          conditioning: ["100", 0]
        },
        class_type: "FluxKontextMultiReferenceLatentMethod",
        _meta: { title: "Multi Reference (Negative)" }
      },
      // VAE Encode
      "105": {
        inputs: {
          pixels: ["107", 0],
          vae: ["95", 0]
        },
        class_type: "VAEEncode",
        _meta: { title: "VAE Encode" }
      },
      // ModelSamplingAuraFlow
      "94": {
        inputs: {
          shift: 3.1,
          model: noLightning ? ["109", 0] : ["102", 0]
        },
        class_type: "ModelSamplingAuraFlow",
        _meta: { title: "ModelSamplingAuraFlow" }
      },
      // CFGNorm
      "98": {
        inputs: {
          strength: 1,
          model: ["94", 0]
        },
        class_type: "CFGNorm",
        _meta: { title: "CFGNorm" }
      },
      // KSampler
      "106": {
        inputs: {
          seed,
          steps,
          cfg: 1,
          sampler_name: "euler",
          scheduler: "simple",
          denoise: 1,
          model: ["98", 0],
          positive: ["97", 0],
          negative: ["96", 0],
          latent_image: ["105", 0]
        },
        class_type: "KSampler",
        _meta: { title: "KSampler" }
      },
      // VAE Decode
      "103": {
        inputs: {
          samples: ["106", 0],
          vae: ["95", 0]
        },
        class_type: "VAEDecode",
        _meta: { title: "VAE Decode" }
      },
      // Save Image
      "9": {
        inputs: {
          filename_prefix: "nora-multiangle",
          images: ["103", 0]
        },
        class_type: "SaveImage",
        _meta: { title: "Save Image" }
      }
    },
    client_id: "nora-multiangle"
  };

  // Add Lightning LoRA if enabled (default)
  if (!noLightning) {
    workflow.prompt["102"] = {
      inputs: {
        lora_name: "Qwen-Image-Edit-Lightning-4steps-V1.0-bf16.safetensors",
        strength_model: 1,
        model: ["109", 0]
      },
      class_type: "LoraLoaderModelOnly",
      _meta: { title: "LoRA: Lightning 4-step" }
    };
  }

  return workflow;
}

// --- Supabase functions ---

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

// --- ComfyUI functions ---

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
        // SaveImage node is "9" in multiangle workflow
        const saveNode = outputs["9"];
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
  const name = `${safeMarca}_multiangle_${Date.now()}.png`;
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

// --- Main ---

async function main() {
  log('🎯 NORA Multi-Angle Camera Control');
  log(`📷 Imagen: ${imageUrl}`);
  log(`🔄 Ángulo: ${anglePrompt}`);
  log(`🎲 Seed: ${seed}`);
  log(`⚡ Lightning: ${noLightning ? 'OFF' : 'ON'} (${steps} steps)`);

  // Check ComfyUI is alive
  try {
    const r = await fetch(`${COMFY}/system_stats`, { signal: AbortSignal.timeout(5000) });
    const sysStats = await r.json();
    log(`ComfyUI v${sysStats.system.comfyui_version} — ${sysStats.devices[0].name.split(':')[1].trim()}`);
  } catch (e) {
    log('❌ ComfyUI no responde en ' + COMFY);
    log('   1. PC-2 apagada → encender');
    log('   2. ComfyUI no corre → run_nvidia_gpu_network.bat');
    log('   3. IP cambió → verificar COMFY_URL en .env');
    process.exit(1);
  }

  const workflow = buildWorkflow(imageUrl, anglePrompt, seed);

  const promptId = await queuePrompt(workflow);
  log(`⏳ Queued (${promptId.substring(0, 8)}...)`);

  const startTime = Date.now();
  const imageInfo = await waitForCompletion(promptId);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`✅ Generada: ${imageInfo.filename} (${elapsed}s)`);

  const imageBuffer = await downloadImage(imageInfo.filename, imageInfo.subfolder, imageInfo.type);
  log(`📥 Descargada (${(imageBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  // Upload + update Supabase if --id provided
  if (onlyId) {
    const resultUrl = await uploadToSupabase(imageBuffer, 'multiangle');
    log(`☁️ Subida: ${resultUrl}`);
    await updateCreatividad(onlyId, resultUrl);
    log(`✅ #${onlyId} → para_revision`);
  }

  await sendTgMessage(`🔄 Multi-Angle generado\n📷 ${anglePrompt}\n🎲 Seed: ${seed}\n⏱️ ${elapsed}s${onlyId ? `\n🆔 #${onlyId}` : ''}`);

  log('🎉 Listo!');
}

// --- Entry point ---

process.on('uncaughtException', (e) => { log(`💥 UNCAUGHT: ${e.message}\n${e.stack}`); });
process.on('unhandledRejection', (e) => { log(`💥 UNHANDLED REJECTION: ${e?.message || e}\n${e?.stack || ''}`); });

main().catch(e => { log(`💥 ERROR: ${e.message}\n${e.stack}`); process.exit(1); });
