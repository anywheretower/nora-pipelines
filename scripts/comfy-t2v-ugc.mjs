/**
 * NORA — Text-to-Video UGC (LTX-Video 2.3 con audio + RTX upscale)
 * Genera video vía ComfyUI remoto (PC-2), merge audio, upscale RTX x2, sube a Supabase Storage.
 *
 * Uso: node comfy-t2v-ugc.mjs [--once] [--id=123] [--max=1]
 *   --once    Procesa lo pendiente y sale (no hace polling)
 *   --id=123  Procesa solo esa creatividad
 *   --max=N   Máximo N videos por corrida (default: 1, por VRAM leak con LTX)
 *
 * La creatividad debe tener:
 *   - prompt: texto para LTX-Video 2.3
 *   - url: URL del audio WAV en Supabase Storage
 *   - origen: "ugc"
 *   - estado: "para_ejecucion"
 */

// --- Load .env from project root ---
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

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

const COMFY = process.env.COMFY_URL ?? 'http://192.168.1.26:8188';
const SUPA = process.env.SUPABASE_URL ?? 'https://fddokyfilokacsjdgiwe.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZG9reWZpbG9rYWNzamRnaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTc2MDEsImV4cCI6MjA4NTE3MzYwMX0._lY8wLKQ6pudUOp6pKX71YJ9bmwsAaoU794cqJNbdHc';
const POLL_INTERVAL = 30000;
const COMFY_POLL = 5000; // 5s — video takes longer than images

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
const MAX_PER_RUN = maxArg ? parseInt(maxArg.split('=')[1]) : 1; // VRAM leak safety — LTX needs restart after each

function log(msg) {
  const ts = new Date().toLocaleTimeString('es-CL', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function randomSeed() {
  const min = 100000000000000;
  const max = 999999999999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =============================================================
// Workflow builder — LTX-Video 2.3 con audio
// =============================================================

function buildWorkflow(prompt, audioFilename, seed, duration, id) {
  const FPS = 24;
  const WIDTH = 576;
  const HEIGHT = 1024;
  const FRAMES = Math.ceil((Math.ceil(duration * FPS) - 1) / 8) * 8 + 1;
  const NEGATIVE = 'camera equipment, tripod visible, text, watermark, blurry, distorted face, cartoon, ugly, closed mouth, silent, not speaking';

  const w = {};

  // === MODELS (LTX 2.3) ===
  w["100"] = { inputs: { unet_name: "ltx-2-3-22b-dev-Q4_K_M.gguf" }, class_type: "UnetLoaderGGUF" };
  w["101"] = { inputs: { lora_name: "ltx-2.3-22b-distilled-lora-384.safetensors", strength_model: 0.5, model: ["100", 0] }, class_type: "LoraLoaderModelOnly" };
  w["102"] = { inputs: { vae_name: "LTX23_video_vae_bf16.safetensors" }, class_type: "VAELoader" };
  w["103"] = { inputs: { ckpt_name: "LTX23_audio_vae_bf16.safetensors" }, class_type: "LTXVAudioVAELoader" };
  w["104"] = { inputs: { clip_name1: "gemma-3-12b-it-IQ4_XS.gguf", clip_name2: "ltx-2.3_text_projection_bf16.safetensors", type: "ltxv" }, class_type: "DualCLIPLoaderGGUF" };
  w["105"] = { inputs: { model_name: "MelBandRoformer_fp32.safetensors" }, class_type: "MelBandRoFormerModelLoader" };

  // === TEXT ===
  w["200"] = { inputs: { text: prompt, clip: ["104", 0] }, class_type: "CLIPTextEncode" };
  w["201"] = { inputs: { text: NEGATIVE, clip: ["104", 0] }, class_type: "CLIPTextEncode" };
  w["202"] = { inputs: { positive: ["200", 0], negative: ["201", 0], frame_rate: FPS }, class_type: "LTXVConditioning" };

  // === AUDIO — mask=0 para lip sync ===
  w["310"] = { inputs: { audio: audioFilename }, class_type: "LoadAudio" };
  w["311"] = { inputs: { start_index: 0, duration: duration, audio: ["310", 0] }, class_type: "TrimAudioDuration" };
  w["312"] = { inputs: { model: ["105", 0], audio: ["311", 0] }, class_type: "MelBandRoFormerSampler" };
  w["313"] = { inputs: { audio: ["312", 0], audio_vae: ["103", 0] }, class_type: "LTXVAudioVAEEncode" };
  w["314"] = { inputs: { samples: ["313", 0], mask: ["315", 0] }, class_type: "SetLatentNoiseMask" };
  w["315"] = { inputs: { value: 0.0, width: 1, height: 1 }, class_type: "SolidMask" };

  // === STAGE 1: Base resolution ===
  w["300"] = { inputs: { width: WIDTH, height: HEIGHT, length: FRAMES, batch_size: 1 }, class_type: "EmptyLTXVLatentVideo" };
  w["320"] = { inputs: { video_latent: ["300", 0], audio_latent: ["314", 0] }, class_type: "LTXVConcatAVLatent" };

  w["400"] = { inputs: { noise_seed: seed }, class_type: "RandomNoise" };
  w["401"] = { inputs: { model: ["101", 0], positive: ["202", 0], negative: ["202", 1], cfg: 1.5 }, class_type: "CFGGuider" };
  w["402"] = { inputs: { sampler_name: "euler_ancestral_cfg_pp" }, class_type: "KSamplerSelect" };
  w["403"] = { inputs: { sigmas: "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0" }, class_type: "ManualSigmas" };
  w["404"] = { inputs: { noise: ["400", 0], guider: ["401", 0], sampler: ["402", 0], sigmas: ["403", 0], latent_image: ["320", 0] }, class_type: "SamplerCustomAdvanced" };

  // Separate AV latent
  w["410"] = { inputs: { av_latent: ["404", 0] }, class_type: "LTXVSeparateAVLatent" };

  // Save video latent for later upscale (only video, not AV — NestedTensor can't be saved)
  w["411"] = { inputs: { samples: ["410", 0], filename_prefix: `LTX-2.3/ugc_${id}_latent` }, class_type: "SaveLatent" };

  // === DECODE ===
  w["700"] = { inputs: { samples: ["410", 0], vae: ["102", 0], tile_size: 512, overlap: 64, temporal_size: 512, temporal_overlap: 4 }, class_type: "VAEDecodeTiled" };
  w["701"] = { inputs: { samples: ["410", 1], audio_vae: ["103", 0] }, class_type: "LTXVAudioVAEDecode" };

  // === OUTPUT ===
  w["800"] = {
    inputs: {
      frame_rate: FPS, loop_count: 0,
      filename_prefix: "nora-t2v-ugc",
      format: "video/h264-mp4", pix_fmt: "yuv420p", crf: 19,
      save_metadata: true, trim_to_audio: false, pingpong: false, save_output: true,
      images: ["700", 0], audio: ["701", 0]
    },
    class_type: "VHS_VideoCombine"
  };

  return w;
}

// =============================================================
// Supabase helpers
// =============================================================

async function getPendingCreatividades() {
  let url = `${SUPA}/rest/v1/creatividades?estado=eq.para_ejecucion&origen=eq.ugc&prompt=not.is.null&url=not.is.null&select=id,prompt,marca,url,concepto&order=id.asc`;
  if (onlyId) {
    url = `${SUPA}/rest/v1/creatividades?id=eq.${onlyId}&origen=eq.ugc&select=id,prompt,marca,url,concepto`;
  }
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${KEY}`, 'apikey': KEY } });
  const data = await r.json();
  return data.filter(c => c.prompt && c.prompt.trim().length > 0 && c.url && c.url.trim().length > 0);
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

async function updateCreatividad(id, videoUrl) {
  const r = await fetch(`${SUPA}/rest/v1/creatividades?id=eq.${id}`, {
    method: 'PATCH',
    headers: supaHeaders,
    body: JSON.stringify({
      estado: 'base_lista',
      link_ren_1: videoUrl,
      link_ren_2: videoUrl,
      condicion: 'para_revision'
    })
  });
  if (r.status !== 204) throw new Error(`Update failed: ${r.status}`);
}

// =============================================================
// Audio helpers
// =============================================================

async function downloadAudio(audioUrl) {
  log(`  📥 Descargando audio: ${audioUrl.split('/').pop()}`);
  const r = await fetch(audioUrl);
  if (!r.ok) throw new Error(`Audio download failed: ${r.status} ${r.statusText}`);
  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function padAudioWithSilence(audioBuffer, silenceSeconds = 1.0) {
  // Append silence to the end of audio WAV using ffmpeg
  const ts = Date.now();
  const tmpIn = join(__dirname, `_tmp_pad_in_${ts}.wav`);
  const tmpOut = join(__dirname, `_tmp_pad_out_${ts}.wav`);
  writeFileSync(tmpIn, audioBuffer);
  try {
    execSync(
      `ffmpeg -i "${tmpIn}" -af "apad=pad_dur=${silenceSeconds}" -y "${tmpOut}"`,
      { stdio: 'pipe' }
    );
    const padded = readFileSync(tmpOut);
    log(`  🔇 Silencio añadido: +${silenceSeconds}s al final del audio`);
    return padded;
  } finally {
    try { unlinkSync(tmpIn); } catch {}
    try { unlinkSync(tmpOut); } catch {}
  }
}

async function getAudioDuration(audioBuffer) {
  // Write to temp file, use ffprobe to get duration
  const tmpPath = join(__dirname, `_tmp_audio_${Date.now()}.wav`);
  writeFileSync(tmpPath, audioBuffer);
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tmpPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return parseFloat(output);
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

async function uploadAudioToComfyUI(audioBuffer, filename) {
  // ComfyUI /upload/image accepts any binary file (including WAV)
  const boundary = '----NoraBoundary' + Date.now();
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: audio/wav\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const headerBuf = Buffer.from(header);
  const footerBuf = Buffer.from(footer);
  const body = Buffer.concat([headerBuf, audioBuffer, footerBuf]);

  const r = await fetch(`${COMFY}/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body: body
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Audio upload to ComfyUI failed: ${r.status} ${err}`);
  }
  const data = await r.json();
  log(`  ☁️ Audio subido a ComfyUI: ${data.name}`);
  return data.name;
}

// =============================================================
// ComfyUI helpers
// =============================================================

async function queuePrompt(workflow) {
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'nora-ltx23-ugc' })
  });
  const data = await r.json();
  if (data.error) throw new Error(`ComfyUI error: ${JSON.stringify(data.error)}`);
  return data.prompt_id;
}

async function waitForCompletion(promptId, maxWait = 900000) {
  // 15 min timeout for video (much longer than images)
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

      // VHS_VideoCombine uses "gifs" key (not "images")
      const outputs = entry.outputs;
      if (outputs) {
        const videoNode = outputs["800"];
        if (videoNode && videoNode.gifs && videoNode.gifs.length > 0) {
          const vid = videoNode.gifs[0];
          return { filename: vid.filename, subfolder: vid.subfolder ?? '', type: vid.type ?? 'output' };
        }
      }
    } catch (e) {
      if (e.message.includes('ComfyUI execution error')) throw e;
      // Network error, retry
    }
  }
  throw new Error(`Timeout waiting for ComfyUI video (${maxWait / 1000}s)`);
}

async function downloadVideo(filename, subfolder, type) {
  const params = new URLSearchParams({ filename, type });
  if (subfolder) params.set('subfolder', subfolder);
  const r = await fetch(`${COMFY}/view?${params}`);
  if (!r.ok) throw new Error(`Video download failed: ${r.status} ${r.statusText}`);
  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// =============================================================
// RTX Video Super Resolution (upscale x2)
// =============================================================

function buildRTXUpscaleWorkflow(videoFilename) {
  return {
    "6": { class_type: "LoadVideo", inputs: { file: videoFilename } },
    "7": { class_type: "GetVideoComponents", inputs: { video: ["6", 0] } },
    "1": { class_type: "RTXVideoSuperResolution", inputs: { images: ["7", 0], resize_type: "scale by multiplier", "resize_type.scale": 2.0, quality: "ULTRA" } },
    "8": { class_type: "CreateVideo", inputs: { images: ["1", 0], audio: ["7", 1], fps: ["7", 2] } },
    "9": { class_type: "SaveVideo", inputs: { video: ["8", 0], filename_prefix: "video/rtx_upscale", format: "mp4", codec: "auto" } }
  };
}

async function uploadVideoToComfyUI(videoBuffer, filename) {
  const boundary = '----NoraBoundary' + Date.now();
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: video/mp4\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(header), videoBuffer, Buffer.from(footer)]);

  const r = await fetch(`${COMFY}/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString()
    },
    body
  });
  if (!r.ok) throw new Error(`Video upload to ComfyUI failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  log(`  ☁️ Video subido a ComfyUI: ${data.name}`);
  return data.name;
}

async function waitForRTXUpscale(promptId, maxWait = 600000) {
  // 10 min timeout (RTX upscale is fast, ~5-15s)
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, COMFY_POLL));
    try {
      const r = await fetch(`${COMFY}/history/${promptId}`);
      const history = await r.json();
      const entry = history[promptId];
      if (!entry) continue;

      if (entry.status?.status_str === 'error') {
        throw new Error(`RTX upscale error: ${JSON.stringify(entry.status)}`);
      }

      const outputs = entry.outputs;
      if (outputs) {
        const saveNode = outputs["9"];
        if (saveNode && saveNode.images && saveNode.images.length > 0) {
          const vid = saveNode.images[0];
          return { filename: vid.filename, subfolder: vid.subfolder ?? '', type: vid.type ?? 'output' };
        }
      }
    } catch (e) {
      if (e.message.includes('RTX upscale error')) throw e;
    }
  }
  throw new Error(`Timeout waiting for RTX upscale (${maxWait / 1000}s)`);
}

// =============================================================
// ffmpeg: merge Cartesia audio into video
// =============================================================

function mergeAudio(videoBuffer, audioBuffer) {
  const ts = Date.now();
  const tmpVideo = join(__dirname, `_tmp_video_${ts}.mp4`);
  const tmpAudio = join(__dirname, `_tmp_audio_${ts}.wav`);
  const tmpOut = join(__dirname, `_tmp_out_${ts}.mp4`);
  writeFileSync(tmpVideo, videoBuffer);
  writeFileSync(tmpAudio, audioBuffer);
  try {
    execSync(
      `ffmpeg -i "${tmpVideo}" -i "${tmpAudio}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${tmpOut}" -y`,
      { stdio: 'pipe' }
    );
    const outputBuffer = readFileSync(tmpOut);
    log(`  🔊 Audio mergeado (${(outputBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
    return outputBuffer;
  } finally {
    try { unlinkSync(tmpVideo); } catch {}
    try { unlinkSync(tmpAudio); } catch {}
    try { unlinkSync(tmpOut); } catch {}
  }
}

// =============================================================
// Supabase Storage upload
// =============================================================

async function uploadToSupabase(videoBuffer, marca) {
  const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const name = `${safeMarca}_ugc_${Date.now()}.mp4`;
  const r = await fetch(`${SUPA}/storage/v1/object/creatividades/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'apikey': ANON,
      'Content-Type': 'video/mp4'
    },
    body: videoBuffer
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Upload failed: ${r.status} ${err}`);
  }
  const data = await r.json();
  return `${SUPA}/storage/v1/object/public/${data.Key}`;
}

// =============================================================
// Main processing
// =============================================================

async function processOne(creatividad) {
  const { id, prompt, marca, url: audioUrl } = creatividad;
  log(`▶ #${id} [${marca}] — Generando video UGC...`);

  // 0. Mark as processing to prevent duplicate pickup
  await markAsProcessing(id);

  // 1. Download audio from Supabase
  const rawAudio = await downloadAudio(audioUrl);
  log(`  📥 Audio descargado (${(rawAudio.length / 1024).toFixed(0)} KB)`);

  // 2. Pad audio with 1s silence at the end (for smile transition to pack de cierre)
  const audioBuffer = padAudioWithSilence(rawAudio, 1.0);

  // 3. Get padded audio duration
  const audioDuration = await getAudioDuration(audioBuffer);
  const duration = audioDuration + 0.5; // slightly longer than padded audio
  log(`  🎵 Duración audio (con silencio): ${audioDuration.toFixed(1)}s → video: ${duration.toFixed(1)}s`);

  // 4. Upload padded audio to ComfyUI input folder
  const audioFilename = `nora_ugc_${id}_${Date.now()}.wav`;
  const comfyAudioName = await uploadAudioToComfyUI(audioBuffer, audioFilename);

  // 5. Build workflow and queue
  const seed = randomSeed();
  const workflow = buildWorkflow(prompt, comfyAudioName, seed, duration, id);
  const promptId = await queuePrompt(workflow);
  log(`  ⏳ Queued (${promptId.substring(0, 8)}...) seed=${seed} duration=${duration.toFixed(1)}s`);

  // 6. Wait for video completion
  const videoInfo = await waitForCompletion(promptId);
  log(`  ✅ Video generado: ${videoInfo.filename}`);

  // 7. Download from ComfyUI
  const rawBuffer = await downloadVideo(videoInfo.filename, videoInfo.subfolder, videoInfo.type);
  log(`  📥 Descargado (${(rawBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  // 8. Merge padded Cartesia audio into video (includes trailing silence)
  const mergedBuffer = mergeAudio(rawBuffer, audioBuffer);

  // 9. RTX Video Super Resolution (x2 upscale)
  log(`  🚀 RTX upscale x2 — subiendo video a ComfyUI...`);
  const rtxInputName = await uploadVideoToComfyUI(mergedBuffer, `nora_ugc_${id}_base_${Date.now()}.mp4`);
  const rtxWorkflow = buildRTXUpscaleWorkflow(rtxInputName);
  const rtxPromptId = await queuePrompt(rtxWorkflow);
  log(`  ⏳ RTX queued (${rtxPromptId.substring(0, 8)}...)`);

  const rtxInfo = await waitForRTXUpscale(rtxPromptId);
  log(`  ✅ RTX upscale listo: ${rtxInfo.filename}`);

  const upscaledBuffer = await downloadVideo(rtxInfo.filename, rtxInfo.subfolder, rtxInfo.type);
  log(`  📥 Upscaled descargado (${(upscaledBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  // 10. Upload to Supabase Storage (1152×2048 — postprod Remotion escala a 1080×1920)
  const videoUrl = await uploadToSupabase(upscaledBuffer, marca);
  log(`  ☁️ Subido: ${videoUrl.split('/').pop()}`);

  // 12. Update creatividad
  await updateCreatividad(id, videoUrl);
  log(`  ✅ #${id} → para_revision`);
  stats.ok++;

  return videoUrl;
}

const stats = { ok: 0, fail: 0 };

async function run() {
  log('🎬 NORA Text-to-Video UGC — Iniciando');

  // Check ComfyUI is alive
  try {
    const r = await fetch(`${COMFY}/system_stats`, { signal: AbortSignal.timeout(5000) });
    const sysStats = await r.json();
    log(`ComfyUI v${sysStats.system.comfyui_version} — ${sysStats.devices[0].name.split(':')[1].trim()}`);
  } catch {
    log('❌ ComfyUI no responde en ' + COMFY);
    log('');
    log('   Posibles causas:');
    log('   1. PC-2 está apagada → encender PC-2');
    log('   2. ComfyUI no está corriendo → ejecutar run_nvidia_gpu_network.bat en PC-2');
    log('   3. IP cambió → verificar IP de PC-2 y actualizar COMFY_URL en .env');
    process.exit(1);
  }

  if (!KEY) {
    log('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
    process.exit(1);
  }

  // Check ffmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    log('❌ ffmpeg no encontrado — necesario para merge de audio');
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
        log('Sin videos pendientes. Saliendo.');
        break;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }

    const c = pending[0];
    log(`📋 ${pending.length} pendiente(s) — Procesando #${c.id} [${c.marca}]`);

    try {
      await processOne(c);
    } catch (e) {
      log(`❌ #${c.id} Error: ${e.message}`);
      await markAsError(c.id, e.message);
      log(`  ⚠️ #${c.id} → estado=error`);
      stats.fail++;
    }

    // Límite por corrida (VRAM leak con LTX)
    if (stats.ok + stats.fail >= MAX_PER_RUN) {
      log(`🛑 Límite de ${MAX_PER_RUN} video(s) por corrida alcanzado.`);
      break;
    }

    if (onlyId || once) break;

    // Pausa entre videos
    log('  ⏸ 10s antes del siguiente...');
    await new Promise(r => setTimeout(r, 10000));
  }

  log(`👋 Fin — ✅ ${stats.ok} generados, ❌ ${stats.fail} fallidos`);
}

process.on('uncaughtException', (e) => { log(`💥 UNCAUGHT: ${e.message}\n${e.stack}`); });
process.on('unhandledRejection', (e) => { log(`💥 UNHANDLED REJECTION: ${e?.message ?? e}\n${e?.stack ?? ''}`); });

run().catch(e => { log(`💥 RUN ERROR: ${e.message}\n${e.stack}`); process.exit(1); });
