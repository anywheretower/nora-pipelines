/**
 * NORA — Upscale UGC Video (Stage 1.5: LTX 2.3 latent upscale)
 * Upscales a video latent saved by comfy-t2v-ugc.mjs (LTX 2.3) via ComfyUI remoto (PC-2).
 *
 * Uso: node upscale-ugc.mjs --id=123 [--once]
 *   --id=123  Creatividad ID (required)
 *   --once    Procesa y sale (default behavior, since upscale is single)
 *
 * La creatividad debe tener:
 *   - estado: "base_lista"
 *   - origen: "video"
 *   - condicion: "aprobado" o "para_revision"
 *   - url: URL del audio WAV en Supabase Storage
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
const COMFY_POLL = 5000;

// SSH config for PC-2
const SSH_HOST = process.env.SSH_HOST ?? 'conta@192.168.1.26';
const COMFY_OUTPUT_DIR = 'C:\\Users\\conta\\Downloads\\ComfyUI_windows_portable_nvidia_cu128\\ComfyUI_windows_portable\\ComfyUI\\output';
const COMFY_INPUT_DIR = 'C:\\Users\\conta\\Downloads\\ComfyUI_windows_portable_nvidia_cu128\\ComfyUI_windows_portable\\ComfyUI\\input';

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

if (!onlyId) {
  console.error('Uso: node upscale-ugc.mjs --id=<ID> [--once]');
  process.exit(1);
}

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
// Workflow builder — LTX 2.3 latent upscale + refine
// =============================================================

function buildWorkflow(latentFilename, audioFilename, audioDuration, seed) {
  const FPS = 24;
  const w = {};

  // === MODELS ===
  w["100"] = { inputs: { unet_name: "ltx-2-3-22b-dev-Q4_K_M.gguf" }, class_type: "UnetLoaderGGUF" };
  w["101"] = { inputs: { lora_name: "ltx-2.3-22b-distilled-lora-384.safetensors", strength_model: 0.5, model: ["100", 0] }, class_type: "LoraLoaderModelOnly" };
  w["102"] = { inputs: { vae_name: "LTX23_video_vae_bf16.safetensors" }, class_type: "VAELoader" };
  w["103"] = { inputs: { ckpt_name: "LTX23_audio_vae_bf16.safetensors" }, class_type: "LTXVAudioVAELoader" };
  w["104"] = { inputs: { clip_name1: "gemma-3-12b-it-IQ4_XS.gguf", clip_name2: "ltx-2.3_text_projection_bf16.safetensors", type: "ltxv" }, class_type: "DualCLIPLoaderGGUF" };
  w["105"] = { inputs: { model_name: "MelBandRoformer_fp32.safetensors" }, class_type: "MelBandRoFormerModelLoader" };
  w["106"] = { inputs: { model_name: "ltx-2.3-spatial-upscaler-x2-1.0.safetensors" }, class_type: "LatentUpscaleModelLoader" };

  // === LOAD VIDEO LATENT from stage 1 (only video, no AV) ===
  w["300"] = { inputs: { latent: latentFilename }, class_type: "LoadLatent" };

  // === RE-ENCODE AUDIO (needed for AV concat) ===
  w["310"] = { inputs: { audio: audioFilename }, class_type: "LoadAudio" };
  w["311"] = { inputs: { start_index: 0, duration: audioDuration, audio: ["310", 0] }, class_type: "TrimAudioDuration" };
  w["312"] = { inputs: { model: ["105", 0], audio: ["311", 0] }, class_type: "MelBandRoFormerSampler" };
  w["313"] = { inputs: { audio: ["312", 0], audio_vae: ["103", 0] }, class_type: "LTXVAudioVAEEncode" };
  w["314"] = { inputs: { samples: ["313", 0], mask: ["315", 0] }, class_type: "SetLatentNoiseMask" };
  w["315"] = { inputs: { value: 0.0, width: 1, height: 1 }, class_type: "SolidMask" };

  // === TEXT (empty — latent already has visual info) ===
  w["200"] = { inputs: { text: "", clip: ["104", 0] }, class_type: "CLIPTextEncode" };
  w["201"] = { inputs: { text: "", clip: ["104", 0] }, class_type: "CLIPTextEncode" };
  w["202"] = { inputs: { positive: ["200", 0], negative: ["201", 0], frame_rate: FPS }, class_type: "LTXVConditioning" };

  // === UPSCALE video latent x2 ===
  w["500"] = { inputs: { samples: ["300", 0], upscale_model: ["106", 0], vae: ["102", 0] }, class_type: "LTXVLatentUpsampler" };

  // Concat upscaled video + re-encoded audio latent
  w["520"] = { inputs: { video_latent: ["500", 0], audio_latent: ["314", 0] }, class_type: "LTXVConcatAVLatent" };

  // === STAGE 2: Refine 3 steps ===
  w["600"] = { inputs: { noise_seed: seed }, class_type: "RandomNoise" };
  w["601"] = { inputs: { model: ["101", 0], positive: ["202", 0], negative: ["202", 1], cfg: 1.0 }, class_type: "CFGGuider" };
  w["602"] = { inputs: { sampler_name: "euler_cfg_pp" }, class_type: "KSamplerSelect" };
  w["603"] = { inputs: { sigmas: "0.85, 0.7250, 0.4219, 0.0" }, class_type: "ManualSigmas" };
  w["604"] = { inputs: { noise: ["600", 0], guider: ["601", 0], sampler: ["602", 0], sigmas: ["603", 0], latent_image: ["520", 0] }, class_type: "SamplerCustomAdvanced" };

  // Separate stage 2
  w["610"] = { inputs: { av_latent: ["604", 0] }, class_type: "LTXVSeparateAVLatent" };

  // === DECODE ===
  w["700"] = { inputs: { samples: ["610", 0], vae: ["102", 0], tile_size: 512, overlap: 64, temporal_size: 512, temporal_overlap: 4 }, class_type: "VAEDecodeTiled" };
  w["701"] = { inputs: { samples: ["610", 1], audio_vae: ["103", 0] }, class_type: "LTXVAudioVAEDecode" };

  // === OUTPUT ===
  w["800"] = {
    inputs: {
      frame_rate: FPS, loop_count: 0,
      filename_prefix: "nora-upscale-ugc",
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

async function getCreatividad(id) {
  const url = `${SUPA}/rest/v1/creatividades?id=eq.${id}&select=id,marca,url,link_ren_2,estado,origen,condicion`;
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${KEY}`, 'apikey': KEY } });
  const data = await r.json();
  if (!data.length) throw new Error(`Creatividad ${id} no encontrada`);
  return data[0];
}

async function updateCreatividad(id, videoUrl) {
  const r = await fetch(`${SUPA}/rest/v1/creatividades?id=eq.${id}`, {
    method: 'PATCH',
    headers: supaHeaders,
    body: JSON.stringify({ link_ren_2: videoUrl })
  });
  if (r.status !== 204) throw new Error(`Update failed: ${r.status}`);
}

// =============================================================
// Audio helpers
// =============================================================

async function downloadAudio(audioUrl) {
  log(`  Descargando audio: ${audioUrl.split('/').pop()}`);
  const r = await fetch(audioUrl);
  if (!r.ok) throw new Error(`Audio download failed: ${r.status} ${r.statusText}`);
  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getAudioDuration(audioBuffer) {
  const tmpPath = join(__dirname, `_tmp_audio_dur_${Date.now()}.wav`);
  writeFileSync(tmpPath, audioBuffer);
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${tmpPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return parseFloat(output);
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }
}

async function uploadAudioToComfyUI(audioBuffer, filename) {
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
  log(`  Audio subido a ComfyUI: ${data.name}`);
  return data.name;
}

// =============================================================
// SSH helper
// =============================================================

function ssh(cmd) {
  const fullCmd = `ssh ${SSH_HOST} "${cmd.replace(/"/g, '\\"')}"`;
  log(`  SSH: ${cmd}`);
  return execSync(fullCmd, {
    encoding: 'utf-8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

// =============================================================
// ComfyUI helpers
// =============================================================

async function queuePrompt(workflow) {
  const r = await fetch(`${COMFY}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'nora-upscale-ugc' })
  });
  const data = await r.json();
  if (data.error) throw new Error(`ComfyUI error: ${JSON.stringify(data.error)}`);
  return data.prompt_id;
}

async function waitForCompletion(promptId, maxWait = 1200000) {
  // 20 min timeout for upscale (larger resolution = longer)
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
  throw new Error(`Timeout waiting for ComfyUI upscale (${maxWait / 1000}s)`);
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
// ffmpeg: resize 1152x2048 → 1080x1920 + merge Cartesia audio
// =============================================================

function resizeAndMergeAudio(inputBuffer, audioBuffer) {
  const ts = Date.now();
  const tmpIn = join(__dirname, `_tmp_in_${ts}.mp4`);
  const tmpResized = join(__dirname, `_tmp_resized_${ts}.mp4`);
  const tmpAudio = join(__dirname, `_tmp_audio_${ts}.wav`);
  const tmpOut = join(__dirname, `_tmp_out_${ts}.mp4`);
  writeFileSync(tmpIn, inputBuffer);
  writeFileSync(tmpAudio, audioBuffer);
  try {
    // Step 1: Resize video (mute)
    execSync(
      `ffmpeg -i "${tmpIn}" -vf "scale=1080:1920:flags=lanczos" -c:v libx264 -crf 18 -an "${tmpResized}" -y`,
      { stdio: 'pipe' }
    );
    // Step 2: Merge Cartesia audio
    execSync(
      `ffmpeg -i "${tmpResized}" -i "${tmpAudio}" -c:v copy -c:a aac -b:a 192k -map 0:v -map 1:a -shortest "${tmpOut}" -y`,
      { stdio: 'pipe' }
    );
    const outputBuffer = readFileSync(tmpOut);
    log(`  Resized 1152x2048 → 1080x1920 + audio (${(outputBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
    return outputBuffer;
  } finally {
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
    try { unlinkSync(tmpResized); } catch { /* ignore */ }
    try { unlinkSync(tmpAudio); } catch { /* ignore */ }
    try { unlinkSync(tmpOut); } catch { /* ignore */ }
  }
}

// =============================================================
// Supabase Storage upload
// =============================================================

async function uploadToSupabase(videoBuffer, marca) {
  const safeMarca = marca.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const name = `creatividades/${safeMarca}_ugc_upscaled_${Date.now()}.mp4`;
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
  const { id, marca, url: audioUrl, condicion } = creatividad;
  log(`Upscaling #${id} [${marca}] (condicion: ${condicion})`);

  // 1. Move latent from output to input on PC-2
  const latentSrc = `${COMFY_OUTPUT_DIR}\\LTX-2.3\\ugc_${id}_latent_00001_.latent`;
  const latentDst = `${COMFY_INPUT_DIR}\\ugc_${id}_latent.latent`;
  const latentFilename = `ugc_${id}_latent.latent`;

  ssh(`copy "${latentSrc}" "${latentDst}"`);
  log(`  Latent copiado a input: ${latentFilename}`);

  // 2. Download audio, get duration, upload to ComfyUI (needed for AV re-encode)
  const audioBuffer = await downloadAudio(audioUrl);
  log(`  Audio descargado (${(audioBuffer.length / 1024).toFixed(0)} KB)`);

  const audioDuration = await getAudioDuration(audioBuffer);
  const totalDuration = audioDuration + 0.5;
  log(`  Audio: ${audioDuration.toFixed(1)}s → duration: ${totalDuration.toFixed(1)}s`);

  const audioFilename = `nora_ugc_upscale_${id}_${Date.now()}.wav`;
  const comfyAudioName = await uploadAudioToComfyUI(audioBuffer, audioFilename);

  // 3. Build workflow and queue
  const seed = randomSeed();
  const workflow = buildWorkflow(latentFilename, comfyAudioName, totalDuration, seed);
  const promptId = await queuePrompt(workflow);
  log(`  Queued (${promptId.substring(0, 8)}...) seed=${seed}`);

  // 4. Wait for completion
  const videoInfo = await waitForCompletion(promptId);
  log(`  Video upscaled: ${videoInfo.filename}`);

  // 5. Download from ComfyUI
  const rawBuffer = await downloadVideo(videoInfo.filename, videoInfo.subfolder, videoInfo.type);
  log(`  Descargado (${(rawBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  // 6. ffmpeg resize 1152x2048 → 720x1280 + merge Cartesia audio
  const finalBuffer = resizeAndMergeAudio(rawBuffer, audioBuffer);

  // 7. Upload to Supabase Storage
  const videoUrl = await uploadToSupabase(finalBuffer, marca);
  log(`  Subido: ${videoUrl.split('/').pop()}`);

  // 8. Update creatividad (keep estado=base_lista, keep condicion)
  await updateCreatividad(id, videoUrl);
  log(`  #${id} link_ren_2 actualizado`);

  return videoUrl;
}

async function run() {
  log('NORA Upscale UGC — Iniciando');

  // Check ComfyUI is alive
  try {
    const r = await fetch(`${COMFY}/system_stats`, { signal: AbortSignal.timeout(5000) });
    const sysStats = await r.json();
    log(`ComfyUI v${sysStats.system.comfyui_version} — ${sysStats.devices[0].name.split(':')[1].trim()}`);
  } catch {
    log('ComfyUI no responde en ' + COMFY);
    log('');
    log('   Posibles causas:');
    log('   1. PC-2 esta apagada → encender PC-2');
    log('   2. ComfyUI no esta corriendo → ejecutar run_nvidia_gpu_network.bat en PC-2');
    log('   3. IP cambio → verificar IP de PC-2 y actualizar COMFY_URL en .env');
    process.exit(1);
  }

  if (!KEY) {
    log('SUPABASE_SERVICE_ROLE_KEY no configurada');
    process.exit(1);
  }

  // Check ffmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    log('ffmpeg no encontrado — necesario para resize');
    process.exit(1);
  }

  // Read creatividad
  let creatividad;
  try {
    creatividad = await getCreatividad(onlyId);
  } catch (e) {
    log(`Error leyendo creatividad: ${e.message}`);
    process.exit(1);
  }

  // Validate state
  if (creatividad.estado !== 'base_lista') {
    log(`Creatividad #${onlyId} tiene estado="${creatividad.estado}" (esperado: base_lista). Abortando.`);
    process.exit(1);
  }
  if (creatividad.origen !== 'video') {
    log(`Creatividad #${onlyId} tiene origen="${creatividad.origen}" (esperado: video). Abortando.`);
    process.exit(1);
  }
  const validCondiciones = ['aprobado', 'para_revision'];
  if (!validCondiciones.includes(creatividad.condicion)) {
    log(`Creatividad #${onlyId} tiene condicion="${creatividad.condicion}" (esperado: aprobado o para_revision). Abortando.`);
    process.exit(1);
  }
  if (!creatividad.url) {
    log(`Creatividad #${onlyId} no tiene audio URL (campo url). Abortando.`);
    process.exit(1);
  }

  try {
    const videoUrl = await processOne(creatividad);
    log(`Upscale completado: ${videoUrl}`);
  } catch (e) {
    log(`Error: ${e.message}`);
    process.exit(1);
  }

  log('Fin');
}

process.on('uncaughtException', (e) => { log(`UNCAUGHT: ${e.message}\n${e.stack}`); });
process.on('unhandledRejection', (e) => { log(`UNHANDLED REJECTION: ${e?.message ?? e}\n${e?.stack ?? ''}`); });

run().catch(e => { log(`RUN ERROR: ${e.message}\n${e.stack}`); process.exit(1); });
