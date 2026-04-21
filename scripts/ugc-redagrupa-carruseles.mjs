/**
 * NORA — UGC RedAgrupa por cada carrusel
 * Genera 7 videos UGC: uno por carrusel (IDs 35, 51, 52, 54, 55, 56, 62)
 * Patrón: gran titular → 2 datos interesantes → invita a redagrupa.cl
 *
 * Modos:
 *   --preview  Solo genera audios WAV locales en tmp_redagrupa_ugc/ e imprime libretos
 *              (no sube a Storage, no inserta creatividades)
 *   (default)  Genera audio → sube a Storage → inserta creatividad para_ejecucion
 *   --only=0,2 Ejecutar solo las configs con esos indices (0-6)
 *
 * Render posterior: node comfy-t2v-ugc.mjs --once --id=<N>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const SUPA = process.env.SUPABASE_URL ?? 'https://fddokyfilokacsjdgiwe.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CARTESIA_KEY = process.env.CARTESIA_API_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZG9reWZpbG9rYWNzamRnaXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTc2MDEsImV4cCI6MjA4NTE3MzYwMX0._lY8wLKQ6pudUOp6pKX71YJ9bmwsAaoU794cqJNbdHc';

if (!KEY || !CARTESIA_KEY) {
  console.error('Faltan SUPABASE_SERVICE_ROLE_KEY o CARTESIA_API_KEY en .env');
  process.exit(1);
}

const log = (m) => console.log(`[${new Date().toLocaleTimeString('es-CL', { hour12: false })}] ${m}`);

// =============================================================
// 7 configs — uno por carrusel
// =============================================================

const CONFIGS = [
  {
    carrusel_id: 62,
    carrusel_tema: 'Cómo funciona RedAgrupa (4 pasos, sin costo)',
    voz: { nombre: 'Alejandro', id: 'b7326db8-ce99-4332-be06-496654056bb0' },
    libreto: 'Cuatro pasos para tener seguro complementario de salud en tu empresa con Red Agrupa. Uno: les cuentas sobre tu pyme. Dos: comparan aseguradoras. Tres: negocian la mejor tarifa. Cuatro: gestionan todo por ti. Conoce más en redagrupa punto cele.',
    slogan: '4 pasos para tener seguro complementario con Red Agrupa.',
    personaje: 'Chilean man in his mid-thirties with short neatly styled brown hair, short well-groomed stubble beard, warm brown eyes, athletic lean build, a small-business owner speaking as a satisfied customer, sitting in the driver seat of his parked car just outside his small business',
    vestuario: 'a plain solid navy blue cotton henley shirt, no logos no branding no text no graphics',
    fragmento: '"Cuatro pasos para tener seguro complementario de salud en tu empresa con Red Agrupa."',
    tono: 'conversational complicit warm',
    lente: '35mm lens',
    framing_override: 'chest-up framing showing the subject seated in the driver seat with the steering wheel and dashboard partially visible in the lower edge of the frame, static locked-off tripod-mounted camera inside the car on the passenger side, no camera movement',
    escenario_subject: 'sitting inside his own parked car outside his small business, one hand casually resting on the steering wheel',
    escenario_fondo: 'Background: the interior of his parked car with the steering wheel and dashboard visible in the lower portion of the frame, side passenger window on the right letting in soft natural daylight, a blurred out-of-focus commercial street storefront visible through the windshield on the left, organic asymmetrical everyday composition, NOT centered NOT symmetrical, realistic lived-in car interior',
  },
  {
    carrusel_id: 56,
    carrusel_tema: 'Checklist: ¿aprovechas tu seguro?',
    voz: { nombre: 'Tamara', id: 'f3435884-3cf5-45bf-ae28-c84a2d00e24d' },
    libreto: 'Apuesto que a ti también te pasa: tu equipo no sabe cómo funcionan bien las coberturas ni los reembolsos de su seguro. A mi pyme nos pasaba. Haz el checklist tú mismo en redagrupa punto cele y lo vas a ver clarito.',
    slogan: 'Apuesto que a ti también te pasa.',
    personaje: 'Chilean woman in her late thirties with loose shoulder-length medium brown hair, warm brown eyes, light natural makeup, slender build, an HR manager at a small company speaking as a satisfied customer, holding a clipboard with invoices in her hand',
    vestuario: 'a plain solid cream knit sweater, no logos no branding no text no graphics',
    fragmento: '"Apuesto que a ti también te pasa: tu equipo no sabe cómo funcionan las coberturas."',
    tono: 'conversational complicit empathetic',
    lente: '40mm lens',
    escenario_subject: 'standing at her accounting desk reviewing paper invoices, holding a clipboard in one hand',
    escenario_fondo: 'Background: a small company accounting office with a wooden desk covered in paper invoices and folders on her side, a tall metal filing cabinet with labeled binders visible off-center to the right, an open laptop partially visible on the left side of the desk, soft natural daylight from a window, organic asymmetrical lived-in working composition, NOT centered NOT symmetrical',
  },
  {
    carrusel_id: 55,
    carrusel_tema: '4 mitos del seguro complementario',
    voz: { nombre: 'Francisco', id: 'efa0580f-5056-4094-b0ea-e2ab3e73b02a' },
    libreto: 'No saltes este consejo: el seguro complementario no es solo para grandes empresas. Mi pyme es de siete personas y Red Agrupa me cotizó sin costo. Ojo con los mitos. Míralos en redagrupa punto cele.',
    slogan: 'No saltes este consejo.',
    personaje: 'Chilean man in his early forties with dark neatly combed hair showing graying temples, well-groomed medium beard, calm confident expression, robust athletic build, a small-business owner speaking as a satisfied customer, holding a clipboard with inventory notes',
    vestuario: 'a plain solid charcoal gray polo shirt, no logos no branding no text no graphics',
    fragmento: '"No saltes este consejo: el seguro complementario no es solo para grandes empresas."',
    tono: 'conversational complicit assertive',
    lente: '35mm lens',
    escenario_subject: 'standing in the middle of the concrete floor of his own industrial warehouse, holding a clipboard',
    escenario_fondo: 'Background: his own industrial pyme warehouse with tall metal shelving racks holding cardboard boxes visible off-center to the right, an orange forklift parked in the far background on the left, a large open warehouse door letting in bright natural daylight, polished concrete floor, soft ambient industrial lighting mixed with daylight, organic asymmetrical realistic working warehouse composition, NOT centered NOT symmetrical',
  },
  {
    carrusel_id: 54,
    carrusel_tema: 'RedAgrupa en números (+300, 9k, 9 aseguradoras)',
    voz: { nombre: 'Karla K', id: '709610b9-d32b-4bf5-b3d1-979a87c0eafe' },
    libreto: '¿Sabías que más de trescientas pymes chilenas ya confían en Red Agrupa para sus seguros complementarios de salud? Yo soy una de esas. Comparan entre las mejores coberturas del mercado y eligen la indicada para mi empresa. Mira los números en redagrupa punto cele.',
    slogan: '¿Sabías que ya son +300 pymes?',
    personaje: 'Chilean woman in her late thirties with long straight black hair, rectangular black-framed glasses, natural makeup, slender build, a small-business manager speaking as a satisfied customer, holding a clipboard while checking merchandise boxes',
    vestuario: 'a plain solid burgundy fitted top, no logos no branding no text no graphics',
    fragmento: '"¿Sabías que más de trescientas pymes chilenas ya confían en Red Agrupa para sus seguros complementarios de salud?"',
    tono: 'conversational complicit warm',
    lente: '40mm lens',
    escenario_subject: 'standing in her own pyme stockroom next to a metal shelving unit, checking boxes of merchandise with a clipboard in hand',
    escenario_fondo: 'Background: her own pyme stockroom with tall metal industrial shelving visible off-center to the left holding labeled cardboard boxes of various sizes, a hand-truck cart partially visible in the far right corner, bright mixed overhead warehouse lighting with some natural daylight, organic asymmetrical realistic working stockroom composition, NOT centered NOT symmetrical',
  },
  {
    carrusel_id: 52,
    carrusel_tema: '¿Por qué tu pyme necesita seguro complementario?',
    voz: { nombre: 'Aline', id: 'af38f9da-1e72-4c72-9ed6-c19b85f716dc' },
    libreto: 'Apuesto que a ti también te pasa: pierdes gente buena. Las pymes con seguro complementario retienen hasta un treinta por ciento más, y es gasto aceptado por el servicio de impuestos internos. Conoce cómo mejorar las condiciones de tu equipo en redagrupa punto cele.',
    slogan: 'Apuesto que a ti también te pasa.',
    personaje: 'Chilean woman in her early thirties with wavy medium-length honey-brown hair, soft natural makeup, gentle warm smile lines, slender build, a small-business owner speaking as a satisfied customer, holding a ceramic coffee mug with both hands',
    vestuario: 'a plain solid terracotta cotton blouse, no logos no branding no text no graphics',
    fragmento: '"Apuesto que a ti también te pasa: pierdes gente buena."',
    tono: 'conversational complicit warm',
    lente: '35mm lens',
    escenario_subject: 'standing in her own small company open-plan office with a ceramic coffee mug in her hands',
    escenario_fondo: 'Background: her own pyme open-plan office with several work desks visible in the far background showing out-of-focus colleagues working at their computers, soft warm ambient office lighting, a glimpse of a window on the right letting in natural daylight, organic asymmetrical realistic working office composition, NOT centered NOT symmetrical, shallow depth of field making the background colleagues pleasantly blurred',
  },
  {
    carrusel_id: 51,
    carrusel_tema: '3 cosas que tu seguro cubre y no sabías',
    voz: { nombre: 'Tono Mo', id: 'fd83dfd9-b866-45a0-baf2-73965b2b9ab2' },
    libreto: 'No saltes este consejo: nosotros no sabíamos cómo sacarle todo el partido a nuestro seguro complementario de salud. En Red Agrupa nos asesoraron y nos explicaron todo. Si quieres aprovechar mejor tu seguro complementario, visita redagrupa punto cele.',
    slogan: 'No saltes este consejo.',
    personaje: 'Chilean man in his early forties with short salt-and-pepper hair, well-groomed medium salt-and-pepper beard, kind brown eyes, robust medium build, a small-business owner speaking as a satisfied customer, holding an open folder with contract documents',
    vestuario: 'a plain solid navy blue v-neck sweater over a plain white t-shirt, no logos no branding no text no graphics',
    fragmento: '"No saltes este consejo: no sabíamos cómo sacarle todo el partido a nuestro seguro complementario de salud."',
    tono: 'conversational complicit reassuring',
    lente: '40mm lens',
    escenario_subject: 'standing at his own office desk with an open folder of insurance contract documents in his hands',
    escenario_fondo: 'Background: his own small company office with a wooden desk covered in open folders, insurance policy papers, and a ceramic coffee mug visible off-center to the left, a wall-mounted shelf with labeled archive binders on the right side, a desk lamp casting warm side light, soft natural daylight mixed with warm lamp light, organic asymmetrical realistic working office composition, NOT centered NOT symmetrical',
  },
  {
    carrusel_id: 35,
    carrusel_tema: 'Presentación RedAgrupa',
    voz: { nombre: 'Andrés', id: '9ad449d7-4b36-4260-acda-231ce1a83392' },
    libreto: '¿Sabías que tu pyme puede tener seguro complementario de salud desde cinco personas? Yo no lo sabía hasta que llegué a Red Agrupa. Sin burocracia y con más de diez años de experiencia. Conócelos en redagrupa punto cele.',
    slogan: '¿Sabías que desde 5 personas?',
    personaje: 'Chilean man in his late twenties with neatly styled dark brown hair, clean-shaven, bright friendly eyes, lean athletic build, a young small-business owner speaking as a satisfied customer, holding a medium cardboard product box in both hands',
    vestuario: 'a plain solid olive green cotton t-shirt, no logos no branding no text no graphics',
    fragmento: '"¿Sabías que tu pyme puede tener seguro complementario de salud desde cinco personas?"',
    tono: 'conversational complicit friendly youthful',
    lente: '35mm lens',
    escenario_subject: 'standing in his own small pyme stockroom holding a medium cardboard product box',
    escenario_fondo: 'Background: his own young pyme stockroom with stacked cardboard product boxes visible off-center to the left, a metal shelving unit with organized products and labeled boxes on the right, a small wooden work table partially visible, bright mixed natural and overhead lighting, organic asymmetrical realistic young working stockroom composition, NOT centered NOT symmetrical',
  },
];

// =============================================================
// Prompt builder — template v4 iPhone 16 Pro Max
// =============================================================

function buildPrompt(c) {
  const defaultFraming = 'Wider medium-wide shot framing from mid-thigh up, maintaining this wider framing throughout the entire video, no push-in, no zoom, camera stays at the same focal length. Tripod locked-off, zero camera movement, static wide shot throughout.';
  const framing = c.framing_override || defaultFraming;
  const opener = c.framing_override
    ? `Shot on iPhone 16 Pro Max, 4K Cinematic mode, Apple ProRes LOG. A ${c.personaje} ${c.escenario_subject}.`
    : `Shot on iPhone 16 Pro Max, 4K Cinematic mode, Apple ProRes LOG. A ${c.personaje} ${c.escenario_subject}, medium-wide shot framing from mid-thigh up.`;
  return [
    opener,
    `Wearing ${c.vestuario}.`,
    `Speaking directly to camera with natural expressive hand gestures.`,
    `Speaking in Chilean Spanish with a ${c.tono} tone. ${c.fragmento}`,
    framing,
    `${c.lente}, wide aperture f1.8, shallow depth of field.`,
    `iPhone 16 Pro Max camera characteristics: vivid true-to-life colors, Smart HDR 4 with bright even exposure across entire frame, no underexposed shadows, no overexposed highlights, Photonic Engine computational photography, natural depth effect with smooth bokeh separation. Bright vivid colors, punchy contrast, clean highlight rolloff. Perfect automatic white balance, neutral accurate skin tones with healthy natural glow. High dynamic range preserving detail in shadows and highlights simultaneously.`,
    `${c.escenario_fondo}, with smooth cinematic bokeh, evenly lit.`,
    `Their lips move clearly, matching the audio. At the very end, they stop speaking and give a warm genuine smile directly to camera.`,
    `Vertical 9:16 format.`,
  ].join(' ');
}

// =============================================================
// Cartesia TTS + Supabase upload
// =============================================================

async function generateAudio(libreto, voiceId) {
  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': CARTESIA_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-3',
      transcript: libreto,
      voice: { mode: 'id', id: voiceId },
      output_format: { container: 'wav', encoding: 'pcm_f32le', sample_rate: 44100 },
      experimental_controls: { speed: 'slow' },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cartesia ${res.status}: ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function uploadAudio(buffer, filename) {
  const path = `creatividades/${filename}`;
  const res = await fetch(`${SUPA}/storage/v1/object/creatividades/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'apikey': ANON,
      'Content-Type': 'audio/wav',
    },
    body: buffer,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload ${res.status}: ${t}`);
  }
  return `${SUPA}/storage/v1/object/public/creatividades/${filename}`;
}

async function insertCreatividad(c, promptLTX, audioUrl) {
  const copy = `${c.slogan} — ${c.libreto.replace(' punto cl', '.cl')} #RedAgrupa #SegurosColectivos #Pymes`;
  const concepto = `UGC basado en carrusel #${c.carrusel_id} (${c.carrusel_tema}). Voz ${c.voz.nombre}. Patrón: gran titular + 2 datos + CTA a redagrupa.cl.`;
  const res = await fetch(`${SUPA}/rest/v1/creatividades`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'apikey': KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      marca: 'RedAgrupa',
      estado: 'para_ejecucion',
      origen: 'ugc',
      condicion: null,
      prompt: promptLTX,
      url: audioUrl,
      concepto,
      slogan_headline: c.slogan,
      copy,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`INSERT ${res.status}: ${t}`);
  }
  const [row] = await res.json();
  return row.id;
}

// =============================================================
// Main
// =============================================================

const args = process.argv.slice(2);
const onlyIdx = args.find(a => a.startsWith('--only='));
const targetIdxs = onlyIdx ? onlyIdx.split('=')[1].split(',').map(x => parseInt(x)) : null;
const previewMode = args.includes('--preview');

(async () => {
  if (previewMode) {
    const outDir = join(__dirname, '..', 'tmp_redagrupa_ugc');
    try { mkdirSync(outDir, { recursive: true }); } catch {}
    log(`Modo PREVIEW — generando audios WAV locales en ${outDir}`);
    const rows = [];
    for (let i = 0; i < CONFIGS.length; i++) {
      if (targetIdxs && !targetIdxs.includes(i)) continue;
      const c = CONFIGS[i];
      const tag = `[${i + 1}/${CONFIGS.length}] carrusel #${c.carrusel_id}`;
      try {
        log(`${tag} — ${c.voz.nombre} — generando audio...`);
        const audioBuf = await generateAudio(c.libreto, c.voz.id);
        const fname = `ugc_carrusel_${c.carrusel_id}_${c.voz.nombre.replace(/\s+/g, '_')}.wav`;
        const fpath = join(outDir, fname);
        writeFileSync(fpath, audioBuf);
        const sec = (audioBuf.length / 4 / 44100).toFixed(1); // pcm_f32le = 4 bytes/sample
        log(`${tag} — ✓ ${fname} (~${sec}s)`);
        rows.push({ carrusel_id: c.carrusel_id, voz: c.voz.nombre, slogan: c.slogan, duracion: `${sec}s`, libreto: c.libreto });
      } catch (err) {
        log(`${tag} — ✗ ERROR: ${err.message}`);
      }
    }
    log('');
    log('=== LIBRETOS ===');
    for (const r of rows) {
      console.log(`\n#${r.carrusel_id} — ${r.voz} (${r.duracion})`);
      console.log(`  Slogan: ${r.slogan}`);
      console.log(`  Libreto: ${r.libreto}`);
    }
    log('');
    log(`WAVs en: ${outDir}`);
    log(`Revisa los audios. Si todo ok: node scripts/ugc-redagrupa-carruseles.mjs  (sin --preview)`);
    return;
  }

  log(`Generando ${CONFIGS.length} UGCs para RedAgrupa (uno por carrusel)`);
  const localDir = join(__dirname, '..', 'tmp_redagrupa_ugc');
  const results = [];
  for (let i = 0; i < CONFIGS.length; i++) {
    if (targetIdxs && !targetIdxs.includes(i)) continue;
    const c = CONFIGS[i];
    const tag = `[${i + 1}/${CONFIGS.length}] carrusel #${c.carrusel_id}`;
    try {
      // Reusa audio local ya aprobado si existe (evita regeneración + variaciones)
      const localFname = `ugc_carrusel_${c.carrusel_id}_${c.voz.nombre.replace(/\s+/g, '_')}.wav`;
      const localPath = join(localDir, localFname);
      let audioBuf;
      if (existsSync(localPath)) {
        log(`${tag} — usando audio local aprobado: ${localFname}`);
        audioBuf = readFileSync(localPath);
      } else {
        log(`${tag} — generando audio con ${c.voz.nombre}...`);
        audioBuf = await generateAudio(c.libreto, c.voz.id);
      }

      const ts = Date.now();
      const filename = `redagrupa_ugc_carrusel${c.carrusel_id}_${ts}.wav`;
      log(`${tag} — subiendo WAV a Storage (${(audioBuf.length / 1024).toFixed(1)} KB)...`);
      const audioUrl = await uploadAudio(audioBuf, filename);

      const promptLTX = buildPrompt(c);
      log(`${tag} — INSERT creatividad (estado=para_ejecucion, origen=ugc)...`);
      const id = await insertCreatividad(c, promptLTX, audioUrl);

      log(`${tag} — ✓ creatividad #${id} creada`);
      results.push({ carrusel_id: c.carrusel_id, creatividad_id: id, voz: c.voz.nombre, slogan: c.slogan });
    } catch (err) {
      log(`${tag} — ✗ ERROR: ${err.message}`);
      results.push({ carrusel_id: c.carrusel_id, error: err.message });
    }
  }
  log('');
  log('=== RESULTADOS ===');
  console.table(results);
  log('');
  log('Siguiente paso — render secuencial (1 por corrida por VRAM leak):');
  results.filter(r => r.creatividad_id).forEach(r => {
    log(`  node scripts/comfy-t2v-ugc.mjs --once --id=${r.creatividad_id}`);
  });
})();
