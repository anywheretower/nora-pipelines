/**
 * NORA — Post-producción UGC (Remotion + Whisper)
 * Orquesta desde Mac via SSH a PC-2:
 *   1. Leer creatividad aprobada de Supabase
 *   2. Copiar video + audio a PC-2
 *   3. Transcribir audio con Whisper (PC-2, CUDA) → word timestamps
 *   4. Generar TSX dedicado ({Marca}UGC{ID}.tsx + Feed) con subs hardcodeados
 *   5. Registrar composiciones en Root.tsx de PC-2
 *   6. Render Remotion dual (9:16 + 4:5)
 *   7. Verificar audio (volumedetect)
 *   8. Upload ambos a Supabase Storage
 *   9. Crear creatividad nueva con ambos links
 *
 * Uso: node postprod-ugc.mjs --id=2018
 *
 * El proyecto Remotion ya existe en PC-2: .openclaw/workspace/remotion-nora/src/
 * Cada video UGC genera su propio TSX con subtítulos word-level.
 * Pack de cierre: PackCierre.tsx unificado, props por marca (mapa PACK_PROPS).
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
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
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

// SSH config for PC-2
const SSH_HOST = process.env.SSH_HOST ?? 'conta@192.168.1.26';
const REMOTION_DIR = process.env.REMOTION_DIR ?? 'C:\\Users\\conta\\.openclaw\\workspace\\remotion-nora';
const TEMP_DIR = join(__dirname, '..', '.tmp');

const supaHeaders = {
  'Authorization': `Bearer ${KEY}`,
  'apikey': KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// --- Pack de cierre props por marca ---
// Mismo mapa que Root.tsx — un PackCierre.tsx genérico con props por marca
const PACK_PROPS = {
  'Equos Seguros': { darkBg: '#1E3A5F', accent: '#40E0D0', accentAlt: '#336666', logoFile: 'equos_logo_2.png', logoWidth: 320, groupOffset: 43, urlText: 'segurosequos.com', musicFile: 'equos_cierre_sting_v2.wav', musicVolume: 0.8 },
  'Cemtra': { darkBg: '#1A1A1A', accent: '#FD5200', accentAlt: '#F28C28', logoFile: 'cemtra_logo_3.png', logoWidth: 400, urlText: 'cemtra.cl', musicFile: 'cemtra_cierre_sting.wav' },
  'Clínica San Javier': { darkBg: '#008ea9', accent: '#a5bf00', accentAlt: '#FFFFFF', logoFile: 'csj_id5_logo3.png', logoWidth: 360, logoGap: 12, lineOffset: -30, groupOffset: 43, urlText: 'clinicasanjavier.cl', musicFile: 'csj_cierre_sting.wav' },
  'RTK': { darkBg: '#0A1628', accent: '#0098CC', accentAlt: '#013C68', logoFile: 'rtk_logo_3.png', logoWidth: 320, urlText: 'rtk.cl', musicFile: 'rtk_cierre_sting.wav' },
  'RedAgrupa': { darkBg: '#FF0000', accent: '#FFFFFF', accentAlt: '#C0282B', logoFile: 'redagrupa_logo_1.png', logoWidth: 300, urlText: 'redagrupa.cl', musicFile: 'redagrupa_cierre_sting.wav' },
  'Meser': { darkBg: '#1E3A5F', accent: '#00BCD4', accentAlt: '#6EC6F5', logoFile: 'meser_logo_2.png', logoWidth: 300, urlText: 'meser.cl', musicFile: 'meser_cierre_sting.wav' },
  'Solkinest': { darkBg: '#4BA8B5', accent: '#D4A820', accentAlt: '#D4A820', logoFile: 'solkinest_logo_text.png', logoWidth: 320, urlText: 'solkinest.cl', musicFile: 'solkinest_cierre_sting.wav' },
  'Buses Altas Cumbres': { darkBg: '#002284', accent: '#F6C200', accentAlt: '#002284', logoFile: 'bac_square_white.png', logoWidth: 320, urlText: 'busesaltascumbres.cl', musicFile: 'bac_cierre_synth_v2b.wav' },
  'La Reserva': { darkBg: '#2A9D8F', accent: '#7EDDD3', accentAlt: '#FFFFFF', logoFile: 'lareserva_logo_2.png', logoWidth: 320, urlText: '@lareserva.lago', musicFile: 'lareserva_cierre_sting.wav' },
};

// --- Parse args ---
const args = process.argv.slice(2);
const idArg = args.find(a => a.startsWith('--id='));
const creatividadId = idArg ? parseInt(idArg.split('=')[1]) : null;

if (!creatividadId) {
  console.error('Uso: node postprod-ugc.mjs --id=<ID>');
  process.exit(1);
}

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
  // SCP requires forward slashes for Windows paths
  const safePath = remotePath.replace(/\\/g, '/');
  const cmd = `scp ${SSH_HOST}:"${safePath}" "${localPath}"`;
  log(`SCP: ${remotePath} → ${localPath}`);
  execSync(cmd, { encoding: 'utf-8', timeout: 300000 });
}

// =============================================================
// Step 1: Read creatividad from Supabase
// =============================================================

async function readCreatividad(id) {
  log(`Leyendo creatividad ${id}...`);
  const res = await fetch(
    `${SUPA}/rest/v1/creatividades?id=eq.${id}&select=*`,
    { headers: supaHeaders }
  );
  const data = await res.json();
  if (!data.length) throw new Error(`Creatividad ${id} no encontrada`);
  return data[0];
}

// =============================================================
// Step 2: Transcribe with Whisper (PC-2)
// =============================================================

function transcribeWhisper(audioRemotePath) {
  log('Transcribiendo con Whisper...');
  ssh(
    `whisper "${audioRemotePath}" --model small --language es --output_format json --word_timestamps True --output_dir "${REMOTION_DIR}\\temp"`,
    { timeout: 300000 }
  );

  // Read the JSON result
  const audioName = audioRemotePath.split('\\').pop().replace(/\.[^.]+$/, '');
  const jsonPath = `${REMOTION_DIR}\\temp\\${audioName}.json`;
  const jsonContent = ssh(`type "${jsonPath}"`);
  return JSON.parse(jsonContent);
}

function whisperToSubtitleGroups(whisperJson, fps) {
  // Extract all words with frame numbers (dynamic fps)
  const allWords = [];
  for (const segment of whisperJson.segments) {
    if (!segment.words) continue;
    for (const w of segment.words) {
      allWords.push({
        word: w.word.trim(),
        startFrame: Math.round(w.start * fps),
      });
    }
  }

  // Group into blocks of ~6-8 words (matching EquosUGC1875 pattern)
  const WORDS_PER_GROUP = 7;
  const GAP_FRAMES = 3; // frames between groups
  const groups = [];

  for (let i = 0; i < allWords.length; i += WORDS_PER_GROUP) {
    const groupWords = allWords.slice(i, i + WORDS_PER_GROUP);
    const nextGroupStart = i + WORDS_PER_GROUP < allWords.length
      ? allWords[i + WORDS_PER_GROUP].startFrame
      : groupWords[groupWords.length - 1].startFrame + 30;

    groups.push({
      words: groupWords,
      startFrame: groupWords[0].startFrame,
      endFrame: nextGroupStart - GAP_FRAMES,
    });
  }

  log(`Parsed ${allWords.length} words into ${groups.length} subtitle groups`);
  return groups;
}

// =============================================================
// Step 3: Get video duration in frames
// =============================================================

function getVideoDurationFrames(videoRemotePath, fps) {
  const durResult = ssh(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoRemotePath}"`
  );
  return Math.round(parseFloat(durResult.trim()) * fps);
}

function getVideoFps(videoRemotePath) {
  const fpsResult = ssh(
    `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${videoRemotePath}"`
  );
  // r_frame_rate returns fraction like "24/1" or "30/1"
  const parts = fpsResult.trim().split('/');
  return parts.length === 2 ? Math.round(parseInt(parts[0]) / parseInt(parts[1])) : parseInt(parts[0]);
}

// =============================================================
// Step 4: Generate TSX files
// =============================================================

function generateCompositionTsx(compName, marca, id, groups, videoFile, audioFile, packProps, is45) {
  const fontSize = is45 ? 40 : 48;
  const topPos = is45 ? 100 : 150;
  const sideMargin = is45 ? 35 : 45;
  const gradientHeight = is45 ? '35%' : '40%';
  const objectFit = is45 ? 'objectFit: "cover",' : '';
  const feedSuffix = is45 ? 'Feed' : '';

  const groupsCode = groups.map(g => {
    const wordsStr = g.words.map(w =>
      `      { word: "${w.word.replace(/"/g, '\\"')}", startFrame: ${w.startFrame} },`
    ).join('\n');
    return `  {
    words: [
${wordsStr}
    ],
    startFrame: ${g.startFrame},
    endFrame: ${g.endFrame},
  },`;
  }).join('\n');

  // Poster: first subtitle group words shown static
  const posterWordsCode = groups[0].words.map((w, i) =>
    `              <span
                key={${i}}
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: ${fontSize},
                  color: "#FFFFFF",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)",
                  display: "inline-block",
                }}
              >
                ${w.word.replace(/"/g, '\\"')}
              </span>`
  ).join('\n');

  return `import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { PackCierre } from "./PackCierre";

const { fontFamily } = loadFont();

interface WordEntry {
  word: string;
  startFrame: number;
}

interface SubtitleGroup {
  words: WordEntry[];
  startFrame: number;
  endFrame: number;
}

const subtitleGroups: SubtitleGroup[] = [
${groupsCode}
];

const KaraokeSubtitle: React.FC<{ group: SubtitleGroup }> = ({ group }) => {
  const frame = useCurrentFrame();
  const absoluteFrame = frame + group.startFrame;

  const blockOpacity = interpolate(
    frame,
    [0, 5, group.endFrame - group.startFrame - 8, group.endFrame - group.startFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        top: ${topPos},
        left: ${sideMargin},
        right: ${sideMargin},
        opacity: blockOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          gap: "3px 8px",
          lineHeight: 1.15,
        }}
      >
        {group.words.map((w, i) => {
          const wordVisible = absoluteFrame >= w.startFrame;
          const wordOpacity = wordVisible
            ? interpolate(absoluteFrame - w.startFrame, [0, 3], [0, 1], { extrapolateRight: "clamp" })
            : 0;
          const wordScale = wordVisible
            ? interpolate(absoluteFrame - w.startFrame, [0, 4], [0.85, 1], { extrapolateRight: "clamp" })
            : 0.85;

          return (
            <span
              key={i}
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: ${fontSize},
                color: "#FFFFFF",
                textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)",
                opacity: wordOpacity,
                transform: \`scale(\${wordScale})\`,
                display: "inline-block",
                transformOrigin: "left center",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export interface ${compName}${feedSuffix}Props {
  videoFile: string;
  videoFrames: number;
  audioFile: string;
  audioVolume: number;
  crossfadeFrames: number;
}

export const ${compName}${feedSuffix}: React.FC<${compName}${feedSuffix}Props> = ({
  videoFile,
  videoFrames,
  audioFile,
  audioVolume,
  crossfadeFrames,
}) => {
  const frame = useCurrentFrame();
  const packStart = videoFrames - crossfadeFrames;

  const videoOpacity = interpolate(
    frame,
    [packStart, packStart + crossfadeFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const posterFrame = 60;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* POSTER FRAME */}
      <Sequence from={0} durationInFrames={1}>
        <AbsoluteFill>
          <OffthreadVideo
            src={staticFile(\`videos/\${videoFile}\`)}
            style={{ width: "100%", height: "100%", ${objectFit} }}
            muted
            startFrom={posterFrame}
            endAt={posterFrame + 1}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "${gradientHeight}",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "absolute", top: ${topPos}, left: ${sideMargin}, right: ${sideMargin} }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-start", gap: "3px 8px", lineHeight: 1.15 }}>
${posterWordsCode}
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Video base */}
      <Sequence from={1} durationInFrames={videoFrames}>
        <AbsoluteFill style={{ opacity: videoOpacity }}>
          <OffthreadVideo
            src={staticFile(\`videos/\${videoFile}\`)}
            style={{ width: "100%", height: "100%", ${objectFit} }}
            muted
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "${gradientHeight}",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)",
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Audio TTS */}
      <Sequence from={1}>
        <Audio src={staticFile(\`audio/\${audioFile}\`)} volume={audioVolume} />
      </Sequence>

      {/* Karaoke subtitles */}
      {subtitleGroups.map((group, i) => (
        <Sequence key={i} from={group.startFrame + 1} durationInFrames={group.endFrame - group.startFrame}>
          <KaraokeSubtitle group={group} />
        </Sequence>
      ))}

      {/* Pack de cierre */}
      <Sequence from={packStart + 1} durationInFrames={150 + crossfadeFrames}>
        <PackCierre
          darkBg="${packProps.darkBg}"
          accent="${packProps.accent}"${packProps.accentAlt ? `
          accentAlt="${packProps.accentAlt}"` : ''}
          logoFile="${packProps.logoFile}"
          logoWidth={${packProps.logoWidth ?? 320}}${packProps.logoGap ? `
          logoGap={${packProps.logoGap}}` : ''}${packProps.lineOffset ? `
          lineOffset={${packProps.lineOffset}}` : ''}${packProps.groupOffset ? `
          groupOffset={${packProps.groupOffset}}` : ''}
          urlText="${packProps.urlText}"
          musicFile="${packProps.musicFile}"
          musicVolume={${packProps.musicVolume ?? 0.8}}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
`;
}

function generateRootImports(compName, marca, id, fps = 30) {
  // Returns the import lines and Composition registrations to add to Root.tsx
  const imports = [
    `import { ${compName} } from "./${compName}";`,
    `import { ${compName}Feed } from "./${compName}Feed";`,
  ];

  const compositions916 = `      <Composition
        id="${compName}"
        component={${compName}}
        durationInFrames={DURATION_PLACEHOLDER}
        fps={${fps}}
        width={1080}
        height={1920}
        defaultProps={{
          videoFile: "ugc_${id}.mp4",
          videoFrames: FRAMES_PLACEHOLDER,
          audioFile: "ugc_${id}.wav",
          audioVolume: 1.0,
          crossfadeFrames: 15,
        }}
      />`;

  const compositions45 = `      <Composition
        id="${compName}Feed"
        component={${compName}Feed}
        durationInFrames={DURATION_PLACEHOLDER}
        fps={${fps}}
        width={1080}
        height={1350}
        defaultProps={{
          videoFile: "ugc_${id}.mp4",
          videoFrames: FRAMES_PLACEHOLDER,
          audioFile: "ugc_${id}.wav",
          audioVolume: 1.0,
          crossfadeFrames: 15,
        }}
      />`;

  return { imports, compositions916, compositions45 };
}

// =============================================================
// Step 5: Verify audio levels
// =============================================================

function verifyAudio(videoRemotePath) {
  log('Verificando niveles de audio...');
  const result = ssh(
    `ffmpeg -i "${videoRemotePath}" -af volumedetect -f null NUL 2>&1`
  );
  const meanMatch = result.match(/mean_volume:\s*([-\d.]+)\s*dB/);
  if (meanMatch) {
    const meanVol = parseFloat(meanMatch[1]);
    log(`mean_volume: ${meanVol} dB`);
    if (meanVol < -30) log('WARNING: Audio muy bajo (< -30 dB)');
    if (meanVol > -5) log('WARNING: Audio muy alto (> -5 dB)');
    if (meanVol >= -30 && meanVol <= -5) log('Audio OK');
    return meanVol;
  }
  log('WARNING: No se pudo detectar volumen');
  return null;
}

// =============================================================
// Step 6: Upload to Supabase Storage
// =============================================================

async function uploadToStorage(localPath, storageName) {
  log(`Uploading ${storageName}...`);
  const fileBuffer = readFileSync(localPath);
  const res = await fetch(
    `${SUPA}/storage/v1/object/creatividades/${storageName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'apikey': ANON,
        'Content-Type': 'video/mp4',
      },
      body: fileBuffer,
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Storage upload failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const publicUrl = `${SUPA}/storage/v1/object/public/${data.Key}`;
  log(`Uploaded: ${publicUrl}`);
  return publicUrl;
}

// =============================================================
// Step 7: Create new creatividad with both links
// =============================================================

async function createCreatividadFinal(marca, url45, url916, sourceCreatividad) {
  log('Creando creatividad final...');
  const body = {
    marca,
    origen: 'ugc',
    estado: 'ejecutado',
    condicion: 'para_revision',
    prompt: sourceCreatividad.prompt,
    concepto: sourceCreatividad.concepto,
    copy: sourceCreatividad.copy,
    slogan_headline: sourceCreatividad.slogan_headline,
    link_ren_1: url45,   // 4:5 feed
    link_ren_2: url916,  // 9:16 stories
  };

  const res = await fetch(`${SUPA}/rest/v1/creatividades`, {
    method: 'POST',
    headers: supaHeaders,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`INSERT failed: ${JSON.stringify(data)}`);
  const newId = Array.isArray(data) ? data[0].id : data.id;
  log(`Creatividad final creada: ID ${newId}`);
  return newId;
}

// =============================================================
// Main
// =============================================================

async function main() {
  log(`=== Post-produccion UGC — Creatividad ${creatividadId} ===`);

  // Ensure temp dirs
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
  ssh(`if not exist "${REMOTION_DIR}\\temp" mkdir "${REMOTION_DIR}\\temp"`);

  // 1. Read creatividad
  const crea = await readCreatividad(creatividadId);
  const marca = crea.marca;
  const marcaClean = marca.replace(/[^a-zA-Z0-9]/g, '');
  const compName = `${marcaClean}UGC${creatividadId}`;
  log(`Marca: ${marca}, CompName: ${compName}`);
  log(`Video: ${crea.link_ren_2 ? 'OK' : 'MISSING'}, Audio: ${crea.url ? 'OK' : 'MISSING'}`);

  if (!crea.link_ren_2) throw new Error('Creatividad sin video (link_ren_2)');
  if (!crea.url) throw new Error('Creatividad sin audio (url)');

  // 2. Download video and audio to local temp
  const videoLocal = join(TEMP_DIR, `ugc_${creatividadId}.mp4`);
  const audioLocal = join(TEMP_DIR, `ugc_${creatividadId}.wav`);

  log('Descargando video...');
  const videoRes = await fetch(crea.link_ren_2);
  writeFileSync(videoLocal, Buffer.from(await videoRes.arrayBuffer()));

  log('Descargando audio...');
  const audioRes = await fetch(crea.url);
  writeFileSync(audioLocal, Buffer.from(await audioRes.arrayBuffer()));

  // 3. Copy video + audio to PC-2 (remotion-nora/public/)
  const videoRemote = `${REMOTION_DIR}\\public\\videos\\ugc_${creatividadId}.mp4`;
  const audioRemote = `${REMOTION_DIR}\\public\\audio\\ugc_${creatividadId}.wav`;
  scp(videoLocal, videoRemote);
  scp(audioLocal, audioRemote);

  // Detect video FPS
  const videoFps = getVideoFps(videoRemote);
  log(`Video FPS: ${videoFps}`);

  // 4. Transcribe with Whisper
  const whisperJson = transcribeWhisper(audioRemote);
  const groups = whisperToSubtitleGroups(whisperJson, videoFps);

  // 5. Get video duration
  const videoFrames = getVideoDurationFrames(videoRemote, videoFps);
  const crossfade = 15;
  const totalFrames = videoFrames + 150 - crossfade + 1; // + poster frame
  log(`Video: ${videoFrames} frames (${(videoFrames / videoFps).toFixed(1)}s), total con pack: ${totalFrames}`);

  // 6. Get pack props for marca
  const packProps = PACK_PROPS[marca];
  if (!packProps) {
    log(`WARNING: No pack props for marca "${marca}" — usando defaults`);
  }
  const finalPackProps = packProps ?? { darkBg: '#1a1a1a', accent: '#3b82f6', logoFile: 'logo.png', logoWidth: 320, urlText: marca.toUpperCase(), musicFile: 'pack.wav', musicVolume: 0.8 };
  log(`Pack de cierre: ${finalPackProps.logoFile}`);

  // 7. Generate TSX files
  const tsx916 = generateCompositionTsx(compName, marca, creatividadId, groups, `ugc_${creatividadId}.mp4`, `ugc_${creatividadId}.wav`, finalPackProps, false);
  const tsx45 = generateCompositionTsx(compName, marca, creatividadId, groups, `ugc_${creatividadId}.mp4`, `ugc_${creatividadId}.wav`, finalPackProps, true);

  // Replace duration placeholders
  const tsx916Final = tsx916;
  const tsx45Final = tsx45;

  // Write TSX files locally
  const tsx916Path = join(TEMP_DIR, `${compName}.tsx`);
  const tsx45Path = join(TEMP_DIR, `${compName}Feed.tsx`);
  writeFileSync(tsx916Path, tsx916Final, 'utf-8');
  writeFileSync(tsx45Path, tsx45Final, 'utf-8');

  // 8. Copy TSX files to PC-2
  scp(tsx916Path, `${REMOTION_DIR}\\src\\${compName}.tsx`);
  scp(tsx45Path, `${REMOTION_DIR}\\src\\${compName}Feed.tsx`);

  // 9. Update Root.tsx on PC-2 — add imports and compositions
  // Read current Root.tsx
  const rootContent = ssh(`type "${REMOTION_DIR}\\src\\Root.tsx"`);

  // Check if compositions already registered (re-run scenario)
  const alreadyRegistered = rootContent.includes(`id="${compName}"`);

  if (alreadyRegistered) {
    log('Root.tsx ya contiene composiciones — skip update');
  } else {
    const importLine916 = `import { ${compName} } from "./${compName}";`;
    const importLineFeed = `import { ${compName}Feed } from "./${compName}Feed";`;

    const compBlock916 = `      <Composition
        id="${compName}"
        component={${compName}}
        durationInFrames={${totalFrames}}
        fps={${videoFps}}
        width={1080}
        height={1920}
        defaultProps={{
          videoFile: "ugc_${creatividadId}.mp4",
          videoFrames: ${videoFrames},
          audioFile: "ugc_${creatividadId}.wav",
          audioVolume: 1.0,
          crossfadeFrames: ${crossfade},
        }}
      />`;

    const compBlockFeed = `      <Composition
        id="${compName}Feed"
        component={${compName}Feed}
        durationInFrames={${totalFrames}}
        fps={${videoFps}}
        width={1080}
        height={1350}
        defaultProps={{
          videoFile: "ugc_${creatividadId}.mp4",
          videoFrames: ${videoFrames},
          audioFile: "ugc_${creatividadId}.wav",
          audioVolume: 1.0,
          crossfadeFrames: ${crossfade},
        }}
      />`;

    // Insert imports after last import line
    let newRoot = rootContent;
    const lastImportIdx = rootContent.lastIndexOf('import ');
    const afterLastImport = rootContent.indexOf('\n', lastImportIdx);
    newRoot = rootContent.slice(0, afterLastImport + 1)
      + importLine916 + '\n'
      + importLineFeed + '\n'
      + rootContent.slice(afterLastImport + 1);

    // Insert compositions before closing </>
    const closingTag = newRoot.lastIndexOf('</>');
    newRoot = newRoot.slice(0, closingTag)
      + compBlock916 + '\n'
      + compBlockFeed + '\n'
      + newRoot.slice(closingTag);

    // Write updated Root.tsx via temp file + SCP
    const rootTmpPath = join(TEMP_DIR, 'Root.tsx');
    writeFileSync(rootTmpPath, newRoot, 'utf-8');
    scp(rootTmpPath, `${REMOTION_DIR}\\src\\Root.tsx`);
    log('Root.tsx actualizado con nuevas composiciones');
  }

  // 10. Render both formats
  log(`Rendering ${compName} (9:16, 1080x1920)...`);
  ssh(
    `cd /d "${REMOTION_DIR}" && npx remotion render src/index.ts ${compName} out/${compName}.mp4`,
    { timeout: 600000 }
  );

  log(`Rendering ${compName}Feed (4:5, 1080x1350)...`);
  ssh(
    `cd /d "${REMOTION_DIR}" && npx remotion render src/index.ts ${compName}Feed out/${compName}Feed.mp4`,
    { timeout: 600000 }
  );
  log('Renders completos');

  // 11. Verify audio
  verifyAudio(`${REMOTION_DIR}\\out\\${compName}.mp4`);

  // 12. Download renders
  const local916 = join(TEMP_DIR, `${compName}.mp4`);
  const local45 = join(TEMP_DIR, `${compName}Feed.mp4`);
  scpFrom(`${REMOTION_DIR}\\out\\${compName}.mp4`, local916);
  scpFrom(`${REMOTION_DIR}\\out\\${compName}Feed.mp4`, local45);

  // 13. Upload to Supabase Storage
  const slug = marca.toLowerCase().replace(/\s+/g, '_');
  const ts = Date.now();
  const url916 = await uploadToStorage(local916, `creatividades/${slug}_ugc_${creatividadId}_916.mp4`);
  const url45 = await uploadToStorage(local45, `creatividades/${slug}_ugc_${creatividadId}_45.mp4`);

  // 14. Create final creatividad
  const newId = await createCreatividadFinal(marca, url45, url916, crea);

  // 15. Cleanup local temp
  try {
    unlinkSync(videoLocal);
    unlinkSync(audioLocal);
    unlinkSync(tsx916Path);
    unlinkSync(tsx45Path);
    unlinkSync(rootTmpPath);
    unlinkSync(local916);
    unlinkSync(local45);
  } catch { /* best effort */ }

  log('=== Post-produccion completada ===');
  log(`Creatividad original: ${creatividadId}`);
  log(`Creatividad final: ${newId}`);
  log(`Composiciones: ${compName} + ${compName}Feed`);
  log(`Video 9:16: ${url916}`);
  log(`Video 4:5: ${url45}`);
  log(`Subtitulos: ${groups.reduce((n, g) => n + g.words.length, 0)} palabras en ${groups.length} grupos`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
