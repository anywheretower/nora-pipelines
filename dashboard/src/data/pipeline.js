// ============================================================
// Universal pipeline phases — every pipeline follows this structure
// ============================================================

export const universalPhases = [
  {
    id: 'activador',
    label: 'Activador',
    sublabel: 'Qué inicia el pipeline',
    cls: 'node-trigger',
    icon: '⚡',
    description: 'Todo pipeline comienza con un activador: una instrucción directa del usuario o un evento automático dentro de NORA.',
  },
  {
    id: 'lectura',
    label: 'Lectura',
    sublabel: 'Datos de marca y contexto',
    cls: 'node-input',
    icon: '📋',
    description: 'Se leen los datos necesarios de Supabase: identidad de marca, creatividades anteriores, inputs, y cualquier contexto relevante.',
  },
  {
    id: 'procesamiento',
    label: 'Procesamiento',
    sublabel: 'Lógica creativa',
    cls: 'node-gen',
    icon: '🧠',
    description: 'El trabajo creativo o lógico específico del pipeline: ideación, prompts, textos, configuración de campaña, etc.',
  },
  {
    id: 'ejecucion',
    label: 'Ejecución',
    sublabel: 'Motor de generación',
    cls: 'node-script',
    icon: '🖥️',
    description: 'El motor externo que produce el resultado: ComfyUI (imágenes), Remotion (video), Google Ads MCP (campañas), etc.',
  },
  {
    id: 'entrega',
    label: 'Entrega',
    sublabel: 'Supabase + resultado',
    cls: 'node-step',
    icon: '💾',
    description: 'Se sube el resultado generado a Supabase Storage, se actualizan los campos de la creatividad y se cambia el estado.',
  },
  {
    id: 'qa',
    label: 'QA Auto',
    sublabel: 'Opcional',
    cls: 'node-qa',
    icon: '🤖',
    description: 'Iteración automática de calidad (3 dimensiones text2img, 4 dimensiones img2img). Se puede activar o no al ejecutar el pipeline.',
    optional: true,
  },
  {
    id: 'observacion',
    label: 'Observación',
    sublabel: 'Opcional',
    cls: 'node-obs',
    icon: '👁️',
    description: 'Corrección humana: Jorge revisa en NORA y deja observación. El skill interpreta y corrige.',
    optional: true,
  },
  {
    id: 'upscale',
    label: 'Upscale Latent',
    sublabel: 'Opcional',
    cls: 'node-script',
    icon: '🔍',
    description: 'Spatial upscaler x2 en latent space + refine 3 steps. Toma el latent guardado en stage 1 y genera video en alta resolución.',
    optional: true,
  },
  {
    id: 'postprod',
    label: 'Post-producción',
    sublabel: 'Remotion + Whisper',
    cls: 'node-script',
    icon: '🎬',
    description: 'Post-producción: subtítulos Whisper, composición Remotion (video+audio+subs+pack cierre), render dual.',
    optional: true,
  },
  {
    id: 'entrega_final',
    label: 'Entrega Final',
    sublabel: 'Upload dual + creatividad',
    cls: 'node-step',
    icon: '📦',
    description: 'Upload de ambos formatos a Supabase Storage y creación de creatividad final con ambos links.',
    optional: true,
  },
]

// ============================================================
// Pipelines — each one maps its specifics into the universal phases
// ============================================================

export const pipelines = [
  {
    id: 'text2img-original',
    title: 'Text-to-Image · Original',
    subtitle: 'Imagen 100% original desde texto — sin referencia',
    command: '/nora-creatividad-original',
    status: 'activo',

    // Execution blocks — groups consecutive phases by actual executor
    // This makes handoffs visible and optimization opportunities obvious
    executionBlocks: [
      {
        executor: 'usuario',
        label: 'Usuario',
        phases: ['activador'],
        handoff: 'invoca skill',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-creatividad-original',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-text2img.mjs',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision',
      },
      {
        executor: 'skill',
        label: 'QA Automático: nora-imagen-iteracion',
        phases: ['qa'],
        optional: true,
        handoff: null,
      },
      {
        executor: 'skill',
        label: 'QA Humano: nora-imagen-observacion',
        phases: ['observacion'],
        optional: true,
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Instrucción directa',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /nora-creatividad-original indicando la marca. Se cargan las variables de entorno como prerequisito.',
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario da la instrucción indicando marca, cantidad e instrucciones opcionales.',
            details: [
              'marca — Nombre exacto en Supabase (obligatorio)',
              'cantidad — Número de creatividades (default: 1)',
              'instrucciones — Dirección creativa específica (opcional)',
            ],
          },
          {
            label: 'Cargar variables de entorno',
            resource: { type: 'env', name: '.env' },
            description: 'Se exportan las variables del archivo .env del proyecto.',
            details: [
              'SUPABASE_URL',
              'SUPABASE_SERVICE_ROLE_KEY',
              'COMFY_URL',
            ],
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca + historial',
        executor: 'skill',
        executorDetail: 'nora-creatividad-original',
        stateIn: null,
        stateOut: null,
        description: 'Se hacen 2 queries a Supabase: ficha completa de la marca y todas las creatividades validadas (solo origen referencia y original) para evitar repetir.',
        supabaseFields: {
          reads: {
            marcas: ['ficha', 'arquetipo', 'paleta_colores', 'look_and_feel', 'notas_generales', 'contenido_prohibido', 'logos'],
            creatividades: ['id', 'concepto', 'slogan_headline', 'subtitulo', 'cta', 'copy', 'prompt', 'origen'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Ficha completa: identidad, paleta, look & feel, restricciones.',
            details: [
              'ficha — contexto estratégico',
              'arquetipo — personalidad de marca',
              'paleta_colores — hex y degradados',
              'look_and_feel — dirección visual',
              'notas_generales — reglas específicas',
              'contenido_prohibido — filtro negativo',
            ],
            filter: 'marca = {marca}',
            docs: ['SCHEMA.md', 'SUPABASE.md'],
          },
          {
            label: 'Leer creatividades anteriores',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Todas las creatividades validadas de origen referencia y original para no repetir conceptos, titulares ni tono.',
            details: [
              'id, concepto, slogan_headline, subtitulo',
              'cta, copy, prompt, origen',
            ],
            filter: 'condicion IN (resultado_final, aprobado, para_revision) AND origen IN (referencia, original)',
          },
        ],
      },

      procesamiento: {
        title: 'Concepto + Prompt + Textos + INSERT',
        executor: 'skill',
        executorDetail: 'nora-creatividad-original',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: '5 pasos: idear concepto (skill), construir prompt (skill), escribir textos (doc), extraer estrategia (ficha), insertar en Supabase.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca', 'estado → para_ejecucion', 'origen → original', 'condicion → null',
                'prompt', 'concepto', 'slogan_headline', 'subtitulo', 'cta', 'copy', 'descripcion_corta',
                'gatillador',
                'buyer_persona', 'dolor_anhelo', 'cambio_emocional', 'diferenciador', 'beneficios', 'objeciones_tipicas',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Ideación de concepto',
            resource: { type: 'skill', name: 'nora-imagen-concepto' },
            description: '7 motores creativos + 5 filtros de validación para decidir QUÉ imagen crear.',
            details: [
              'Desplazamiento de rubro — composición de un rubro ajeno',
              'Metáfora visual — objeto como símbolo',
              'Tensión narrativa — contraste entre dos estados',
              'Emoción primaria — 8 emociones publicitarias',
              'Inversión de expectativa — lo opuesto al rubro',
              'Analogía cross-dominio — mundos conectados',
              'Storytelling en un frame — historia completa en una imagen',
            ],
          },
          {
            label: 'Construcción de prompt',
            resource: { type: 'skill', name: 'nora-prompt-master' },
            description: '6 bloques obligatorios, 600-1500 chars, en inglés. Qwen NO entiende negativos.',
            details: [
              'Bloque 1: Calidad y formato (5600K, editorial)',
              'Bloque 2: Concepto principal (sujeto, metáfora)',
              'Bloque 3: Composición espacial (foreground/mid/background)',
              'Bloque 4: Interacción y narrativa',
              'Bloque 5: Iluminación, color y efectos',
              'Bloque 6: Negativos y restricciones',
            ],
          },
          {
            label: 'Textos creativos',
            resource: { type: 'doc', name: 'GUIA-TEXTOS.md' },
            description: 'Slogan, subtítulo, CTA y copy en español adaptados a la marca.',
            details: [
              'slogan_headline — Frase corta de impacto (6-8 palabras)',
              'subtitulo — Complementa y aterriza el headline',
              'cta — Call to action específico y variado',
              'copy — Texto redes sociales (3-5 líneas + hashtags + emojis)',
              'concepto — Dirección creativa (1-2 líneas)',
              'descripcion_corta — Qué comunica y por qué',
            ],
          },
          {
            label: 'Campos de estrategia',
            resource: { type: 'doc', name: 'Ficha de marca' },
            description: 'Se procesan desde la ficha leída en fase anterior y se escriben como campos.',
            details: [
              'buyer_persona — Perfil del público objetivo',
              'dolor_anhelo — Pain point + deseo del cliente',
              'cambio_emocional — Transformación "De X → a Y"',
              'diferenciador — Qué hace diferente a la marca',
              'beneficios — Beneficios clave que comunica',
              'objeciones_tipicas — Objeciones que responde',
            ],
          },
          {
            label: 'Insertar creatividad',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: '18 campos en 3 grupos. La creatividad queda lista para que ComfyUI la procese.',
            details: [
              'Técnicos: marca, estado, origen, prompt, gatillador',
              'Textos: concepto, slogan_headline, subtitulo, cta, copy, descripcion_corta',
              'Estrategia: buyer_persona, dolor_anhelo, cambio_emocional, diferenciador, beneficios, objeciones_tipicas',
            ],
            stateChange: 'NULL → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto (PC-2)',
        executor: 'script',
        executorDetail: 'comfy-text2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'El script marca la creatividad como en_proceso, envía el workflow a ComfyUI en PC-2, espera resultado por polling HTTP y descarga la imagen. Si falla, marca como error.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = original'],
        },
        steps: [
          {
            label: 'Leer creatividad pendiente',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Query a Supabase para obtener creatividades con estado para_ejecucion y origen original.',
            filter: 'estado = para_ejecucion AND origen = original',
          },
          {
            label: 'Enviar workflow a ComfyUI',
            resource: { type: 'script', name: 'comfy-text2img.mjs → POST /prompt' },
            description: 'Envía workflow Qwen con seed aleatoria al servidor ComfyUI remoto.',
            details: [
              'Modelo: Qwen 2.5 VL 7B (GGUF Q4_K_M)',
              'LoRA: Lightning 4-steps V1.0',
              'Sampler: euler, scheduler: simple, steps: 15, cfg: 1.5',
              'Resolución: 1104×1472 (3:4)',
            ],
          },
          {
            label: 'Esperar generación',
            resource: { type: 'script', name: 'comfy-text2img.mjs → poll /history' },
            description: 'Polling cada 3s hasta que aparezca el output en /history.',
            details: [
              'Timeout máximo: 10 minutos',
              'Busca nodo SaveImage (node 136) en outputs',
              'Si status_str = error → falla',
            ],
          },
          {
            label: 'Descargar imagen',
            resource: { type: 'script', name: 'comfy-text2img.mjs → GET /view' },
            description: 'Descarga la imagen generada como buffer vía HTTP.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~1.5 min/imagen (primera ~2.5 min carga modelo)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 4 imágenes por corrida (VRAM leak)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-text2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'ejecutado',
        description: 'La imagen se sube a Supabase Storage y se actualiza la creatividad con la URL y el nuevo estado.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_t2i_{timestamp}.png → bucket creatividades'],
            creatividades: {
              update: ['link_ren_1 → URL pública imagen', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir imagen a Storage',
            resource: { type: 'supabase', name: 'INSERT storage', op: 'INSERT' },
            description: 'Upload al bucket "creatividades" de Supabase Storage.',
            details: ['Nombre: {marca}_t2i_{timestamp}.png'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra la URL de la imagen y cambia el estado.',
            details: [
              'link_ren_1 → URL pública de la imagen',
              'estado → ejecutado',
              'condicion → para_revision',
            ],
            stateChange: 'para_ejecucion → ejecutado',
          },
        ],
      },

      qa: {
        title: 'Iteración QA automática',
        executor: 'skill',
        executorDetail: 'nora-imagen-iteracion',
        optional: true,
        stateIn: 'ejecutado',
        stateOut: 'ejecutado (iteradas) / sin cambio (pasa)',
        description: 'Auto-evaluación visual contra 3 dimensiones. Score ≥4.0 pasa con tags. Score <4.0 duplica con prompt ajustado y regenera. Máximo 3 rondas. Cubre TODOS los pipelines de imagen (original, referencia, universal, requerido, calendario).',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'link_ren_1', 'tags', 'origen', 'condicion'],
            marcas: ['ficha', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_on_pass: ['tags → iterado_rN, score:X.X'],
              insert_on_fail: ['2 nuevas creatividades con prompt corregido, estado → para_ejecucion'],
            },
          },
          filters: ['condicion = para_revision', 'origen IN (original, referencia, universal, requerido, calendario)', 'tags NOT LIKE iterado_r3'],
        },
        steps: [
          {
            label: 'Seleccionar candidatas',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Busca creatividades para_revision excluyendo videos, pantallas y las que agotaron rondas (iterado_r3).',
            filter: 'condicion = para_revision AND origen IN (original, referencia, universal, requerido, calendario) AND tags NOT LIKE iterado_r3',
          },
          {
            label: 'Cargar contexto de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Ficha, paleta, look & feel, contenido prohibido — necesarios para evaluar coherencia de marca.',
          },
          {
            label: 'Evaluar imagen (3 dimensiones)',
            resource: { type: 'skill', name: 'nora-imagen-iteracion' },
            description: 'Análisis visual multimodal de la imagen generada. Score 1-5 por dimensión, promedio total.',
            details: [
              'Dim A: Calidad técnica — anatomía, artefactos, espacio negativo, fondo, vestimenta (peso 2x en espacio para texto)',
              'Dim B: Coherencia de marca — paleta cromática, registro visual, contenido prohibido, tono emocional',
              'Dim C: Impacto publicitario — stopping power, claridad, tensión visual, memorabilidad, emoción, novedad',
            ],
          },
          {
            label: 'Si PASA (≥4.0): agregar tags',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Agrega tags de trazabilidad al registro original. La creatividad queda para revisión humana.',
            details: [
              'tags → "iterado_rN, score:X.X"',
              'condicion permanece para_revision',
            ],
          },
          {
            label: 'Si NO PASA (<4.0): duplicar con prompt ajustado',
            resource: { type: 'supabase', name: 'INSERT creatividades ×2', op: 'INSERT' },
            description: 'Crea 2 versiones nuevas (A y B) con correcciones quirúrgicas al prompt según criterios fallados. La original no se toca.',
            details: [
              'Versión A y B: mismo concepto/textos, prompt corregido, estado → para_ejecucion',
              'Original: no se toca — permanece para_revision',
              'Tags: iterado_r1, iterado_r2 o iterado_r3',
            ],
            stateChange: 'NULL → para_ejecucion (nuevas)',
          },
          {
            label: 'Regenerar imágenes (si iteró)',
            resource: { type: 'script', name: 'comfy-text2img.mjs --once --id=N' },
            description: 'Ejecuta ComfyUI para cada nueva creatividad y vuelve a evaluar (siguiente ronda).',
            details: [
              'Máximo 3 rondas por creatividad original',
              'Cada ronda: evaluar → duplicar → generar → re-evaluar',
              'Ronda 3 forzadamente PASA (sin más iteraciones)',
            ],
          },
        ],
        meta: [
          { icon: '⚡', label: 'Comando', value: '/nora-imagen-iteracion' },
          { icon: '🔄', label: 'Rondas', value: 'Máx 3 — iterado_r1, r2, r3' },
          { icon: '📊', label: 'Umbral', value: 'Score ≥ 4.0 pasa, < 4.0 itera' },
        ],
      },

      observacion: {
        title: 'Observación humana → corrección',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        optional: true,
        manual: true,
        stateIn: 'observado',
        stateOut: 'para_ejecucion (nuevas) / para_revision (solo textos)',
        description: 'Jorge revisa la creatividad en NORA y deja una observación. El skill interpreta el tipo de corrección y actúa según corresponda. NOTA: este paso es manual — requiere invocación de /nora-imagen-observacion. Las creatividades en condicion=observado esperan indefinidamente hasta ser procesadas.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'observacion', 'condicion', 'link_ren_1', 'slogan_headline', 'subtitulo', 'cta', 'copy'],
            marcas: ['ficha', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_textos: ['slogan_headline', 'subtitulo', 'cta', 'copy', 'concepto', 'descripcion_corta', 'condicion → para_revision'],
              insert_imagen: ['2 nuevas creatividades con prompt corregido, estado → para_ejecucion'],
            },
          },
          filters: ['observacion NOT NULL', 'condicion = observado'],
        },
        steps: [
          {
            label: 'Detectar observaciones pendientes',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Busca creatividades con observacion no vacía y condicion=observado.',
            filter: 'observacion NOT NULL AND condicion = observado',
          },
          {
            label: 'Cargar contexto de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Ficha, paleta, look & feel, contenido prohibido — para que las correcciones sigan siendo coherentes.',
          },
          {
            label: 'Interpretar y clasificar observación',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Lee la observación y decide el tipo de corrección necesaria.',
            details: [
              'Validación positiva → aprobar directamente',
              'Ajuste puntual → modificar parte del prompt',
              'Cambio composición → reescribir secciones del prompt',
              'Rehacer completo → nuevo concepto + prompt + textos desde cero',
              'Solo textos → modificar campos sin duplicar',
            ],
          },
          {
            label: 'Si imagen: duplicar con prompt corregido',
            resource: { type: 'supabase', name: 'INSERT creatividades ×2', op: 'INSERT' },
            description: 'Crea 2 versiones (A y B) que resuelven la observación con enfoques ligeramente distintos.',
            details: [
              'Copiar todos los campos de la original excepto id, created_at, link_ren_1, link_ren_2',
              'Prompt corregido según observación, estado → para_ejecucion',
              'Original: NO se toca — observación queda como historial',
            ],
            stateChange: 'NULL → para_ejecucion (nuevas)',
          },
          {
            label: 'Si solo textos: editar directo',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Modifica campos de texto en la original sin duplicar. Limpia observación.',
            details: [
              'slogan_headline, subtitulo, cta, copy, concepto, descripcion_corta',
              'condicion → para_revision',
              'observacion se mantiene como historial',
            ],
          },
          {
            label: 'Generar imágenes (si duplicó)',
            resource: { type: 'script', name: 'comfy-text2img.mjs --once --id=N' },
            description: 'Ejecuta ComfyUI para cada nueva creatividad generada por la observación.',
          },
        ],
        meta: [
          { icon: '⚡', label: 'Comando', value: '/nora-imagen-observacion' },
          { icon: '👁️', label: 'Trigger', value: 'Jorge deja observación en NORA → condicion=observado' },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline 2: Text-to-Image · Referencia (banco de imágenes)
  // ============================================================
  {
    id: 'text2img-referencia',
    title: 'Text-to-Image · Referencia',
    subtitle: 'Imagen inspirada en banco de 160+ referencias etiquetadas',
    command: '/nora-creatividad-referencia',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'usuario',
        label: 'Usuario / Cron / Requerimiento',
        phases: ['activador'],
        handoff: 'invoca skill',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-creatividad-referencia',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-text2img.mjs',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision',
      },
      {
        executor: 'skill',
        label: 'QA Automático: nora-imagen-iteracion',
        phases: ['qa'],
        optional: true,
        handoff: null,
      },
      {
        executor: 'skill',
        label: 'QA Humano: nora-imagen-observacion',
        phases: ['observacion'],
        optional: true,
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Trigger: usuario, cron o requerimiento',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'Se activa por 3 vías: (1) cron automático domingos 21:00 — 3 creatividades por marca activa con refs no usadas; (2) desde tabla requerimientos con estado=referencia y url_ref específica; (3) por pedido directo de Jorge.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario / cron',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario indica marca, cantidad e instrucciones opcionales. O el cron ejecuta automáticamente.',
            details: [
              'Modo automático: 3 creatividades por marca activa (domingos 21:00)',
              'Modo requerimiento: url_ref + temática ya definida',
              'Modo manual: Jorge solicita para marca específica',
            ],
          },
          {
            label: 'Cargar variables de entorno',
            resource: { type: 'env', name: '.env' },
            description: 'Se exportan las variables del archivo .env del proyecto.',
            details: [
              'SUPABASE_URL',
              'SUPABASE_SERVICE_ROLE_KEY',
              'COMFY_URL',
            ],
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca + banco de referencia',
        executor: 'skill',
        executorDetail: 'nora-creatividad-referencia',
        stateIn: null,
        stateOut: null,
        description: 'Se hacen 3 queries a Supabase: ficha de marca, creatividades anteriores (para no repetir conceptos ni referencias) y el banco de imágenes de referencia.',
        supabaseFields: {
          reads: {
            marcas: ['ficha', 'arquetipo', 'paleta_colores', 'look_and_feel', 'notas_generales', 'contenido_prohibido', 'logos'],
            creatividades: ['id', 'concepto', 'slogan_headline', 'subtitulo', 'cta', 'copy', 'prompt', 'url', 'origen'],
            referencia: ['id', 'url', 'summary', 'prompt', 'etiquetas'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Ficha completa: identidad, paleta, look & feel, restricciones.',
            filter: 'marca = {marca}',
            docs: ['SCHEMA.md', 'SUPABASE.md'],
          },
          {
            label: 'Leer creatividades anteriores',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Creatividades validadas para no repetir conceptos, titulares ni referencias ya usadas.',
            filter: 'condicion IN (resultado_final, aprobado, para_revision) AND origen IN (referencia, original)',
          },
          {
            label: 'Leer banco de referencias',
            resource: { type: 'supabase', name: 'READ referencia', op: 'READ' },
            description: 'Banco de 160+ imágenes etiquetadas por 9 dimensiones (composición, técnica, sujeto, metáfora, emoción, paleta, etc.).',
            details: [
              'Cada referencia tiene: url, summary (análisis visual), prompt (prompt base en inglés)',
              'etiquetas por 9 categorías: composición, técnica, sujeto, metáfora, elementos, emoción, paleta, fondo, categoría',
              'Criterios de selección: pertinencia, novedad, creatividad',
            ],
          },
        ],
      },

      procesamiento: {
        title: 'Concepto + Ref + Prompt + Textos + INSERT',
        executor: 'skill',
        executorDetail: 'nora-creatividad-referencia',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: '5 pasos: seleccionar referencia del banco, idear concepto (skill), construir prompt adaptando la referencia a la marca (prompt-master), escribir textos, insertar en Supabase.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca', 'estado → para_ejecucion', 'origen → referencia', 'condicion → null',
                'prompt', 'url → URL imagen de referencia del banco', 'concepto', 'gatillador',
                'slogan_headline', 'subtitulo', 'cta', 'copy', 'descripcion_corta',
                'buyer_persona', 'dolor_anhelo', 'cambio_emocional', 'diferenciador', 'beneficios', 'objeciones_tipicas',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Seleccionar referencia del banco',
            resource: { type: 'supabase', name: 'READ referencia', op: 'READ' },
            description: 'Elige imagen del banco aplicando 3 criterios: pertinencia (relevancia al rubro), novedad (no usada por la marca), creatividad (conexión inesperada).',
            details: [
              'Filtrar por etiquetas: composición, técnica, afinidad de rubro',
              'Verificar que la marca no haya usado esta referencia antes (campo url en creatividades)',
              'Evaluar compatibilidad usando summary y prompt de la referencia',
            ],
          },
          {
            label: 'Ideación de concepto',
            resource: { type: 'skill', name: 'nora-imagen-concepto' },
            description: '7 motores creativos + 5 filtros de validación, guiados por la referencia seleccionada.',
          },
          {
            label: 'Construcción de prompt',
            resource: { type: 'skill', name: 'nora-prompt-master' },
            description: 'Parte del prompt base de la referencia y lo adapta a la marca: paleta, look & feel, arquetipo. 6 bloques, 600-1500 chars, inglés.',
            details: [
              'Bloque 1: Calidad y formato (5600K, editorial)',
              'Bloque 2: Concepto (adaptado de la referencia)',
              'Bloque 3: Composición espacial (foreground/mid/background)',
              'Bloque 4: Interacción y narrativa',
              'Bloque 5: Iluminación, color y efectos (paleta de marca)',
              'Bloque 6: Negativos y restricciones',
            ],
          },
          {
            label: 'Textos creativos',
            resource: { type: 'doc', name: 'GUIA-TEXTOS.md' },
            description: 'Slogan, subtítulo, CTA y copy en español adaptados a la marca y al concepto visual.',
          },
          {
            label: 'Insertar creatividad',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Creatividad completa con prompt, URL de referencia y campos de estrategia. Lista para ComfyUI.',
            details: [
              'Técnicos: marca, estado, origen, prompt, gatillador',
              'Textos: concepto, slogan_headline, subtitulo, cta, copy, descripcion_corta',
              'Estrategia: buyer_persona, dolor_anhelo, cambio_emocional, diferenciador, beneficios, objeciones_tipicas',
              'url → URL de la imagen de referencia usada (trazabilidad)',
            ],
            stateChange: 'NULL → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto (PC-2)',
        executor: 'script',
        executorDetail: 'comfy-text2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'El script marca la creatividad como en_proceso, envía el workflow a ComfyUI en PC-2, espera resultado por polling HTTP y descarga la imagen. Si falla, marca como error. Usa el mismo script que text2img original.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = referencia'],
        },
        steps: [
          {
            label: 'Leer creatividad pendiente',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Query a Supabase para obtener creatividades con estado para_ejecucion y origen referencia.',
            filter: 'estado = para_ejecucion AND origen = referencia',
          },
          {
            label: 'Enviar workflow a ComfyUI',
            resource: { type: 'script', name: 'comfy-text2img.mjs → POST /prompt' },
            description: 'Envía workflow Qwen con seed aleatoria al servidor ComfyUI remoto.',
            details: [
              'Modelo: Qwen 2.5 VL 7B (GGUF Q4_K_M)',
              'LoRA: Lightning 4-steps V1.0',
              'Sampler: euler, scheduler: simple, steps: 15, cfg: 1.5',
              'Resolución: 1104×1472 (3:4)',
            ],
          },
          {
            label: 'Esperar generación',
            resource: { type: 'script', name: 'comfy-text2img.mjs → poll /history' },
            description: 'Polling cada 3s hasta que aparezca el output en /history.',
          },
          {
            label: 'Descargar imagen',
            resource: { type: 'script', name: 'comfy-text2img.mjs → GET /view' },
            description: 'Descarga la imagen generada como buffer vía HTTP.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~1.5 min/imagen (primera ~2.5 min carga modelo)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 4 imágenes por corrida (VRAM leak)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-text2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'ejecutado',
        description: 'La imagen se sube a Supabase Storage y se actualiza la creatividad con la URL y el nuevo estado.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_t2i_{timestamp}.png → bucket creatividades'],
            creatividades: {
              update: ['link_ren_1 → URL pública imagen', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir imagen a Storage',
            resource: { type: 'supabase', name: 'INSERT storage', op: 'INSERT' },
            description: 'Upload al bucket "creatividades" de Supabase Storage.',
            details: ['Nombre: {marca}_t2i_{timestamp}.png'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra la URL de la imagen y cambia el estado.',
            details: [
              'link_ren_1 → URL pública de la imagen',
              'estado → ejecutado',
              'condicion → para_revision',
            ],
            stateChange: 'para_ejecucion → ejecutado',
          },
        ],
      },

      qa: {
        title: 'Iteración QA automática',
        executor: 'skill',
        executorDetail: 'nora-imagen-iteracion',
        optional: true,
        stateIn: 'ejecutado',
        stateOut: 'ejecutado (iteradas) / sin cambio (pasa)',
        description: 'Auto-evaluación visual contra 3 dimensiones. Score ≥4.0 pasa con tags. Score <4.0 duplica con prompt ajustado y regenera. Máximo 3 rondas.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'link_ren_1', 'tags', 'origen', 'condicion'],
            marcas: ['ficha', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_on_pass: ['tags → iterado_rN, score:X.X'],
              insert_on_fail: ['2 nuevas creatividades con prompt corregido, estado → para_ejecucion'],
            },
          },
          filters: ['condicion = para_revision', 'origen IN (original, referencia, universal, requerido, calendario)', 'tags NOT LIKE iterado_r3'],
        },
        steps: [
          {
            label: 'Seleccionar candidatas',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Busca creatividades para_revision excluyendo las que agotaron rondas (iterado_r3).',
            filter: 'condicion = para_revision AND origen = referencia AND tags NOT LIKE iterado_r3',
          },
          {
            label: 'Evaluar imagen (3 dimensiones)',
            resource: { type: 'skill', name: 'nora-imagen-iteracion' },
            description: 'Calidad técnica + Coherencia de marca + Impacto publicitario. Score 1-5.',
          },
          {
            label: 'Si PASA: agregar tags',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Tags de trazabilidad. Condicion permanece para_revision.',
          },
          {
            label: 'Si NO PASA: duplicar + regenerar',
            resource: { type: 'supabase', name: 'INSERT creatividades ×2', op: 'INSERT' },
            description: '2 versiones con prompt ajustado. La original no se toca.',
            stateChange: 'NULL → para_ejecucion (nuevas)',
          },
        ],
        meta: [
          { icon: '📊', label: 'Umbral', value: 'Score ≥ 4.0 pasa, < 4.0 itera' },
          { icon: '🔄', label: 'Rondas', value: 'Máx 3 — iterado_r1, r2, r3' },
        ],
      },

      observacion: {
        title: 'Observación humana → corrección',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        optional: true,
        manual: true,
        stateIn: 'observado',
        stateOut: 'para_ejecucion (nuevas) / para_revision (solo textos)',
        description: 'Jorge revisa la creatividad en NORA y deja una observación. El skill interpreta el tipo de corrección y actúa. Las creatividades en condicion=observado esperan indefinidamente.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'observacion', 'condicion', 'link_ren_1', 'slogan_headline', 'subtitulo', 'cta', 'copy'],
            marcas: ['ficha', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_textos: ['slogan_headline', 'subtitulo', 'cta', 'copy', 'concepto', 'descripcion_corta', 'condicion → para_revision'],
              insert_imagen: ['2 nuevas creatividades con prompt corregido, estado → para_ejecucion'],
            },
          },
          filters: ['observacion NOT NULL', 'condicion = observado'],
        },
        steps: [
          {
            label: 'Detectar + interpretar observación',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Clasifica tipo de cambio y actúa según corresponda.',
          },
          {
            label: 'Duplicar o editar según tipo',
            resource: { type: 'supabase', name: 'INSERT/UPDATE creatividades', op: 'INSERT' },
            description: 'Si imagen: duplica 2 versiones. Si solo textos: edita directo.',
          },
        ],
        meta: [
          { icon: '⚡', label: 'Comando', value: '/nora-imagen-observacion' },
          { icon: '👁️', label: 'Trigger', value: 'Jorge deja observación en NORA → condicion=observado' },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline 3: Image-to-Image · Edición (Qwen Image Edit 2511)
  // ============================================================
  {
    id: 'img2img',
    title: 'Image-to-Image · Edición',
    subtitle: 'Producto · Colaborador · Interior · Exterior · Fachada',
    command: '/nora-creatividad-img2img',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'nora',
        label: 'NORA: "Sorpréndeme NORA" (InputsView)',
        phases: ['activador'],
        handoff: 'creatividad en Supabase (sin prompt)',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-creatividad-img2img',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-img2img.mjs',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision',
      },
      {
        executor: 'skill',
        label: 'QA Automático: nora-imagen-iteracion',
        phases: ['qa'],
        optional: true,
        handoff: null,
      },
      {
        executor: 'skill',
        label: 'QA Humano: nora-imagen-observacion',
        phases: ['observacion'],
        optional: true,
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Creatividad creada desde NORA',
        executor: 'nora',
        stateIn: null,
        stateOut: 'para_procesamiento',
        description: 'En NORA, el usuario sube un input (foto de producto/colaborador/espacio) y presiona "Sorpréndeme NORA". Esto crea una creatividad en Supabase con estado=para_procesamiento, condicion=requerido, origen según categoría, url con la foto, y campos básicos del input. La creatividad queda SIN prompt — esperando que el skill lo genere.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca', 'estado → para_procesamiento', 'condicion → requerido',
                'origen → Producto/Colaborador/Interior/Exterior/Fachada',
                'url → foto de referencia',
                'slogan_headline', 'subtitulo', 'cta', 'concepto',
                'prompt → NULL (lo genera el skill después)',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Usuario sube input en NORA',
            resource: { type: 'usuario', name: 'NORA InputsView' },
            description: 'Sube foto de producto, colaborador, interior, exterior o fachada como input de la marca.',
            details: [
              'Categoría del input define el origen (Producto, Colaborador, Interior, Exterior, Fachada)',
              'Campos del input: titulo, subtitulo, cta, descripccion',
              'La foto queda como url del input',
            ],
          },
          {
            label: '"Sorpréndeme NORA" → INSERT creatividad',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'NORA crea la creatividad directamente en Supabase con los datos del input.',
            details: [
              'estado → para_procesamiento',
              'condicion → requerido',
              'origen → categoría del input (Producto, Colaborador, etc)',
              'url → foto de referencia',
              'titulo, subtitulo, cta, concepto → del input',
              'prompt → NULL (lo genera el skill)',
            ],
            stateChange: 'NULL → para_procesamiento (condicion: requerido)',
          },
          {
            label: 'Skill detecta pendientes',
            resource: { type: 'skill', name: 'nora-creatividad-img2img' },
            description: 'El skill se invoca manualmente o por cron. Busca creatividades con estado=para_procesamiento, origen img2img y sin prompt.',
            filter: 'estado = para_procesamiento AND origen IN (Producto, Colaborador, Interior, Exterior, Fachada) AND prompt IS NULL',
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca + foto original',
        executor: 'skill',
        executorDetail: 'nora-creatividad-img2img',
        stateIn: 'para_procesamiento',
        stateOut: null,
        description: 'Se lee la ficha de marca, la foto de referencia y datos del producto (si aplica).',
        supabaseFields: {
          reads: {
            marcas: ['ficha', 'arquetipo', 'paleta_colores', 'look_and_feel', 'notas_generales', 'contenido_prohibido', 'logos'],
            creatividades: ['id', 'marca', 'url', 'origen', 'concepto', 'slogan_headline', 'subtitulo', 'cta'],
            inputs: ['descripccion (si origen=Producto)'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Ficha completa: identidad, paleta, look & feel, restricciones.',
            details: [
              'ficha, arquetipo, paleta_colores',
              'look_and_feel, notas_generales',
              'contenido_prohibido, logos',
            ],
            filter: 'marca = {marca}',
          },
          {
            label: 'Analizar foto de referencia',
            resource: { type: 'skill', name: 'Análisis visual (multimodal)' },
            description: 'Para Producto: extraer forma, colores, etiquetas, logos, materiales. Para Colaborador: NO analizar. Para espacios: leer concepto existente.',
            details: [
              'Producto: descripción exhaustiva (colores, textos, logos, componentes)',
              'Colaborador: solo usar gatillador + identidad de marca',
              'Interior/Exterior/Fachada: leer concepto + filosofía PRESERVAR y LIMPIAR',
            ],
          },
          {
            label: 'Cargar datos de inputs (si Producto)',
            resource: { type: 'supabase', name: 'READ inputs', op: 'READ' },
            description: 'Campo descripccion de tabla inputs — detalles físicos del producto.',
            filter: 'marca = {marca} AND categoria = Producto',
          },
        ],
      },

      procesamiento: {
        title: 'Prompt de edición + Textos + UPDATE',
        executor: 'skill',
        executorDetail: 'nora-creatividad-img2img',
        stateIn: 'para_procesamiento',
        stateOut: 'para_ejecucion',
        description: 'Construye prompt de edición (800-1100 chars), escribe textos, extrae estrategia y actualiza la creatividad existente en Supabase.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              update: [
                'prompt → instrucción de edición en inglés (800-1100 chars)',
                'copy', 'descripcion_corta',
                'estado → para_ejecucion (transición desde para_procesamiento)',
                'condicion → null (limpia "requerido")',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Construcción de prompt de edición',
            resource: { type: 'skill', name: 'nora-creatividad-img2img' },
            description: 'Prompt en inglés para Qwen Image Edit 2511. 800-1100 chars, preservar sujeto, editar entorno.',
            details: [
              'Producto: preservar producto exacto + describir exhaustivamente (colores, textos, logos, detalles) + mantener misma posición/ángulo de cámara + nuevo entorno creativo',
              'Colaborador: preservar persona + ropa + NO describir persona + nuevo entorno',
              'Interior: preservar + limpiar cables/basura + editorial',
              'Exterior: preservar + limpiar + corregir cielo',
              'Fachada: preservar + limpiar + calidad arquitectónica',
              'Regla: NUNCA rotar ni reposicionar el producto — el entorno se adapta al ángulo original',
            ],
          },
          {
            label: 'Textos creativos',
            resource: { type: 'doc', name: 'GUIA-TEXTOS.md' },
            description: 'Slogan, subtítulo, CTA y copy en español adaptados a la marca.',
            details: [
              'slogan_headline, subtitulo, cta',
              'copy (3-5 líneas + hashtags + emojis)',
              'concepto, descripcion_corta',
            ],
          },
          {
            label: 'Actualizar creatividad (UPDATE)',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'La creatividad ya existe (creada desde NORA). Se actualiza con prompt, copy, se cambia estado a para_ejecucion y se limpia condicion.',
            details: [
              'prompt → instrucción de edición en inglés (800-1100 chars)',
              'copy, descripcion_corta',
              'estado → para_ejecucion',
              'condicion → null (limpia "requerido")',
            ],
            stateChange: 'para_procesamiento → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto — Qwen Image Edit 2511',
        executor: 'script',
        executorDetail: 'comfy-img2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'El script marca en_proceso, carga la imagen de referencia + prompt, envía el workflow de edición a ComfyUI y descarga el resultado. Si falla, marca como error.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'url', 'origen'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen IN (Producto, Colaborador, Interior, Exterior, Fachada)', 'prompt NOT NULL', 'url NOT NULL'],
        },
        steps: [
          {
            label: 'Leer creatividad pendiente',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Query filtrando por estado para_ejecucion + orígenes img2img.',
            filter: 'estado = para_ejecucion AND origen IN (Producto, Colaborador, Interior, Exterior, Fachada)',
          },
          {
            label: 'Cargar imagen de referencia',
            resource: { type: 'script', name: 'comfy-img2img.mjs → LoadImageFromUrlOrPath' },
            description: 'ComfyUI carga la imagen desde la URL de Supabase Storage y la pasa directo al modelo sin resize (igual que el workflow original aprobado).',
            details: [
              'Nodo LoadImageFromUrlOrPath: carga desde URL a resolución original',
              'Nodo VAEEncode: convierte imagen a espacio latente',
              'IMPORTANTE: el input debe estar en formato 1104×1472 (3:4) — sin resize automático',
            ],
          },
          {
            label: 'Ejecutar edición',
            resource: { type: 'script', name: 'comfy-img2img.mjs → KSampler' },
            description: 'Qwen Image Edit procesa la imagen con el prompt de edición.',
            details: [
              'Modelo: Qwen Image Edit fp8',
              'LoRA: Lightning 4-steps V1.0',
              'Sampler: euler, scheduler: simple, steps: 4, cfg: 1',
              'Resolución: nativa del input (idealmente 1104×1472 / 3:4)',
            ],
          },
          {
            label: 'Esperar y descargar',
            resource: { type: 'script', name: 'comfy-img2img.mjs → poll /history + GET /view' },
            description: 'Polling cada 3s hasta completar. Descarga imagen vía HTTP.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~1 min/imagen (primera ~2 min carga modelo)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 4 imágenes por corrida (VRAM leak)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-img2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'ejecutado',
        description: 'La imagen editada se sube a Supabase Storage y se actualiza la creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_i2i_{timestamp}.png → bucket creatividades'],
            creatividades: {
              update: ['link_ren_1 → URL pública imagen', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir imagen a Storage',
            resource: { type: 'supabase', name: 'INSERT storage', op: 'INSERT' },
            description: 'Upload al bucket "creatividades" de Supabase Storage.',
            details: ['Nombre: {marca}_i2i_{timestamp}.png'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra la URL de la imagen editada y cambia el estado.',
            details: [
              'link_ren_1 → URL pública de la imagen',
              'estado → ejecutado',
              'condicion → para_revision',
            ],
            stateChange: 'para_ejecucion → ejecutado',
          },
        ],
      },

      qa: {
        title: 'Iteración QA automática',
        executor: 'skill',
        executorDetail: 'nora-imagen-iteracion',
        optional: true,
        stateIn: 'ejecutado',
        stateOut: 'ejecutado (iteradas) / sin cambio (pasa)',
        description: 'QA con 4 dimensiones (vs 3 de text2img): incluye Consistencia del Input que evalúa fidelidad al original. Score ≥4.0 pasa, <4.0 duplica. Máximo 3 rondas.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'link_ren_1', 'url', 'tags', 'origen', 'condicion'],
            marcas: ['ficha', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_on_pass: ['tags → iterado_rN, score:X.X'],
              insert_on_fail: ['2 nuevas creatividades con prompt de edición corregido, estado → para_ejecucion, url → misma imagen de referencia'],
            },
          },
          filters: ['condicion = para_revision', 'origen IN (Producto, Colaborador, Interior, Exterior, Fachada)', 'tags NOT LIKE iterado_r3'],
        },
        steps: [
          {
            label: 'Evaluar imagen (4 dimensiones)',
            resource: { type: 'skill', name: 'nora-imagen-iteracion' },
            description: 'Calidad técnica + Coherencia de marca + Impacto publicitario + Consistencia del input.',
            details: [
              'Dim A: Calidad técnica — artefactos, espacio negativo, fondo, iluminación',
              'Dim B: Coherencia de marca — paleta, registro visual, tono',
              'Dim C: Impacto publicitario — stopping power, claridad, memorabilidad',
              'Dim D: Consistencia del input — forma, colores, textos/logos, detalles preservados vs original',
            ],
          },
          {
            label: 'Si PASA: agregar tags',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Tags de trazabilidad. Condicion permanece para_revision.',
          },
          {
            label: 'Si NO PASA: duplicar + regenerar',
            resource: { type: 'supabase', name: 'INSERT creatividades ×2', op: 'INSERT' },
            description: '2 versiones con prompt de edición ajustado. La original no se toca.',
            stateChange: 'NULL → para_ejecucion (nuevas)',
          },
        ],
        meta: [
          { icon: '📊', label: 'Umbral', value: 'Score ≥ 4.0 pasa, < 4.0 itera' },
          { icon: '📐', label: 'Dimensiones', value: '4 (A+B+C+D) — D es Consistencia del Input' },
          { icon: '🔄', label: 'Rondas', value: 'Máx 3' },
        ],
      },

      observacion: {
        title: 'Observación humana → corrección',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        optional: true,
        stateIn: 'observado',
        stateOut: 'para_ejecucion (nuevas) / para_revision (solo textos)',
        description: 'Mismo flujo que text2img: Jorge observa en NORA, skill interpreta y corrige.',
        manual: true,
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'observacion', 'condicion', 'link_ren_1', 'url', 'slogan_headline', 'subtitulo', 'cta', 'copy', 'origen'],
            marcas: ['ficha', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_textos: ['slogan_headline', 'subtitulo', 'cta', 'copy', 'concepto', 'descripcion_corta', 'condicion → para_revision'],
              insert_imagen: ['2 nuevas creatividades con prompt de edición corregido, estado → para_ejecucion, url → misma imagen de referencia'],
            },
          },
          filters: ['observacion NOT NULL', 'condicion = observado', 'origen IN (Producto, Colaborador, Interior, Exterior, Fachada)'],
        },
        steps: [
          {
            label: 'Detectar + interpretar observación',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Clasifica tipo de cambio y actúa según corresponda.',
          },
          {
            label: 'Duplicar o editar según tipo',
            resource: { type: 'supabase', name: 'INSERT/UPDATE creatividades', op: 'INSERT' },
            description: 'Si imagen: duplica 2 versiones. Si solo textos: edita directo. Original no se toca.',
          },
        ],
        meta: [
          { icon: '👁️', label: 'Trigger', value: 'Jorge deja observación en NORA → condicion=observado' },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline 3b: Multi-Angle · Cambio de Ángulo (Qwen + Angles LoRA)
  // ============================================================
  {
    id: 'multiangle',
    title: 'Multi-Angle · Cambio de Ángulo',
    subtitle: 'Corrección de ángulo de cámara vía observaciones (Qwen Image Edit + Angles LoRA)',
    command: '/nora-multiangle',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'skill',
        label: 'Skill: nora-imagen-observacion (detecta tipo ángulo)',
        phases: ['activador', 'lectura', 'procesamiento'],
        handoff: 'nueva creatividad (mismo origen) + ejecuta script en modo manual',
      },
      {
        executor: 'script',
        label: 'Script: comfy-multiangle.mjs (modo manual --image --angle --id)',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision',
      },
      {
        executor: 'skill',
        label: 'Observación humana: nora-imagen-observacion',
        phases: ['observacion'],
        optional: true,
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Observación de ángulo detectada',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        stateIn: null,
        stateOut: null,
        description: 'El usuario usa el modal "Cambiar Ángulo" en NORA (3 selectores: azimut, elevación, distancia) que genera una observación estructurada [ángulo] <sks>... O escribe una observación de texto libre sobre ángulo. El skill detecta el tipo y activa este pipeline.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'observacion', 'condicion', 'link_ren_1', 'origen'],
          },
          writes: {},
          filters: ['condicion = observado', 'observacion contiene keywords de ángulo'],
        },
        steps: [
          {
            label: 'Detectar observación de ángulo',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Clasifica la observación. Si contiene keywords de ángulo/perspectiva/cámara → ruta multiangle.',
            details: [
              'Keywords: ángulo, desde arriba/abajo, lateral, girar, contrapicado, picado, más cerca/lejos, perspectiva',
              'Diferencia clave: cambio de perspectiva (multiangle) vs cambio de contenido (duplicar+regenerar)',
            ],
          },
        ],
        meta: [
          { icon: '👁️', label: 'Trigger', value: 'Modal "Ángulo" en NORA o observación de texto libre sobre perspectiva' },
        ],
      },

      lectura: {
        title: 'Análisis visual de ángulo base',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion → nora-multiangle',
        stateIn: null,
        stateOut: null,
        description: 'Analiza la imagen original con visión para detectar el ángulo de cámara actual (azimut, elevación, distancia). Este es el ángulo base sobre el que se aplican los cambios relativos.',
        supabaseFields: {
          reads: {
            creatividades: ['link_ren_1 (imagen a analizar)'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Análisis visual con prompt estructurado',
            resource: { type: 'skill', name: 'Visión multimodal' },
            description: 'Detecta azimut (8 posiciones), elevación (4 posiciones) y distancia (3 posiciones) de la imagen original.',
            details: [
              'Azimut: front, front-right quarter, right side, back-right quarter, back, back-left quarter, left side, front-left quarter',
              'Elevación: low-angle shot, eye-level shot, elevated shot, high-angle shot',
              'Distancia: close-up, medium shot, wide shot',
            ],
          },
        ],
        meta: [
          { icon: '📐', label: 'Combinaciones', value: '96 ángulos posibles (8×4×3)' },
        ],
      },

      procesamiento: {
        title: 'Mapeo español → <sks> + INSERT creatividad',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion → nora-multiangle',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: 'Si viene del modal: el <sks> ya está armado (prefijo [ángulo]). Si es texto libre: analiza imagen + mapea a <sks>. Crea 1 creatividad nueva con el mismo origen que la original.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'Copiar campos de original EXCEPTO id, created_at, link_ren_1, link_ren_2, observacion',
                'prompt → string <sks> (ej: "<sks> right side view elevated shot close-up")',
                'url → link_ren_1 de la original (imagen base)',
                'origen → mismo que la original (NO multiangle)',
                'estado → para_ejecucion',
                'condicion → null',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Interpretar cambio relativo',
            resource: { type: 'skill', name: 'Mapeo español→<sks>' },
            description: 'Ejes no mencionados mantienen ángulo base. "Más arriba" = subir un nivel de elevación, etc.',
            details: [
              'Formato: <sks> [azimut] view [elevación] [distancia]',
              'Ejemplo: "desde la derecha, más arriba" → <sks> right side view elevated shot medium shot',
            ],
          },
          {
            label: 'INSERT creatividad multiangle',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Nueva creatividad con mismo origen, url = imagen original. Script se ejecuta en modo manual.',
            stateChange: 'NULL → para_ejecucion',
          },
        ],
        meta: [
          { icon: '🔄', label: 'Versiones', value: '1 (no 2 como otros tipos de observación)' },
        ],
      },

      ejecucion: {
        title: 'ComfyUI: Qwen fp8mixed + Angles LoRA + Lightning',
        executor: 'script',
        executorDetail: 'comfy-multiangle.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'en_proceso',
        description: 'El script toma la imagen base (url) y el prompt <sks>, genera la misma escena desde el ángulo solicitado. Resolución 1104×1472 (3:4 NORA). Lightning LoRA: 4 steps, ~35-40s.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'url', 'estado', 'origen'],
          },
          writes: {
            creatividades: {
              update: ['estado → en_proceso (pickup)'],
            },
          },
          filters: ['Ejecutado en modo manual por la skill (--image --angle --id)'],
        },
        steps: [
          {
            label: 'Pickup + mark en_proceso',
            resource: { type: 'script', name: 'comfy-multiangle.mjs' },
            description: 'PATCH estado → en_proceso para prevenir procesamiento duplicado.',
            stateChange: 'para_ejecucion → en_proceso',
          },
          {
            label: 'Cargar imagen desde URL',
            resource: { type: 'comfyui', name: 'LoadImageFromUrlOrPath' },
            description: 'Carga la imagen original directamente desde la URL de Supabase Storage.',
          },
          {
            label: 'Escalar a 1104×1472',
            resource: { type: 'comfyui', name: 'ImageScale (lanczos)' },
            description: 'Resolución estándar NORA 3:4.',
          },
          {
            label: 'UNETLoader + LoRA Angles + Lightning',
            resource: { type: 'comfyui', name: 'qwen_image_edit_2511_fp8mixed + Angles LoRA + Lightning LoRA' },
            description: 'fp8mixed obligatorio para compatibilidad con LoRAs. Lightning acelera de 20→4 steps.',
          },
          {
            label: 'TextEncodeQwenImageEditPlus → KSampler',
            resource: { type: 'comfyui', name: 'Encode + Sample (euler, cfg=1, 4 steps)' },
            description: 'Prompt <sks> codificado con imagen de referencia. FluxKontextMultiReferenceLatentMethod preserva la escena.',
          },
          {
            label: 'VAEDecode → SaveImage',
            resource: { type: 'comfyui', name: 'Decode + Save' },
            description: 'Decodifica latents y guarda como nora-multiangle_XXXXX.png.',
          },
        ],
        meta: [
          { icon: '🖥️', label: 'Hardware', value: 'PC-2 (RTX 5080 16GB) — ~35-40s por imagen' },
          { icon: '🧠', label: 'Modelo', value: 'Qwen Image Edit 2511 fp8mixed (19.12 GB)' },
          { icon: '🔧', label: 'LoRAs', value: 'Multiple Angles (281 MB) + Lightning 4-step (281 MB)' },
          { icon: '📐', label: 'Resolución', value: '1104×1472 (3:4)' },
          { icon: '⚡', label: 'Script', value: 'node comfy-multiangle.mjs --image=<url> --angle="<sks>..." --id=N' },
        ],
      },

      entrega: {
        title: 'Upload Storage + UPDATE creatividad',
        executor: 'script',
        executorDetail: 'comfy-multiangle.mjs',
        stateIn: 'en_proceso',
        stateOut: 'ejecutado',
        description: 'Descarga imagen generada de ComfyUI vía HTTP, sube a Supabase Storage, actualiza link_ren_1 y transiciona a ejecutado.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              update: ['link_ren_1 → URL pública de Storage', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
          storage: ['{marca}_multiangle_{timestamp}.png → bucket creatividades'],
        },
        steps: [
          {
            label: 'Descargar de ComfyUI',
            resource: { type: 'comfyui', name: 'GET /view' },
            description: 'Descarga la imagen generada vía HTTP /view API.',
          },
          {
            label: 'Upload a Storage',
            resource: { type: 'supabase', name: 'POST storage/v1/object/creatividades/' },
            description: 'Naming: {safeMarca}_multiangle_{timestamp}.png',
          },
          {
            label: 'UPDATE creatividad',
            resource: { type: 'supabase', name: 'PATCH creatividades', op: 'UPDATE' },
            description: 'link_ren_1, estado → ejecutado, condicion → para_revision.',
            stateChange: 'en_proceso → ejecutado (condicion: para_revision)',
          },
          {
            label: 'Notificación Telegram',
            resource: { type: 'telegram', name: 'sendMessage' },
            description: 'Envía resumen con ángulo, seed y nombre de archivo.',
          },
        ],
        meta: [
          { icon: '💾', label: 'Storage', value: '{marca}_multiangle_{ts}.png' },
        ],
      },

      observacion: {
        title: 'Observación manual',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        manual: true,
        optional: true,
        stateIn: 'observado',
        stateOut: 'para_ejecucion (nuevas) / para_revision (solo textos)',
        description: 'Si el resultado no es satisfactorio, Jorge puede dejar otra observación. Si es de ángulo, vuelve a pasar por este pipeline. Si es de otro tipo, se procesa según corresponda.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'observacion', 'link_ren_1'],
          },
          writes: {
            creatividades: {
              insert: ['Nueva creatividad si requiere re-generación'],
            },
          },
          filters: ['observacion NOT NULL', 'condicion = observado'],
        },
        steps: [
          {
            label: 'Re-clasificar observación',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Puede ser otro ajuste de ángulo o un tipo diferente de corrección.',
          },
        ],
        meta: [
          { icon: '👁️', label: 'Trigger', value: 'Jorge deja observación en NORA → condicion=observado' },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline 4: Pantalla · Imagen (16:9 para TVs)
  // ============================================================
  {
    id: 'pantalla-imagen',
    title: 'Pantalla · Imagen',
    subtitle: '16:9 para TVs en salas de espera — recicla creatividades aprobadas',
    command: '/nora-creatividad-pantalla',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'nora',
        label: 'NORA: aprobación → crear versión Pantalla',
        phases: ['activador'],
        handoff: 'creatividad en Supabase (prompt sin adaptar)',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-creatividad-pantalla',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-text2img.mjs --res=1920x1080',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision',
      },
      {
        executor: 'skill',
        label: 'QA Humano: nora-imagen-observacion',
        phases: ['observacion'],
        optional: true,
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'NORA crea versión Pantalla al aprobar',
        executor: 'nora',
        stateIn: null,
        stateOut: 'para_procesamiento',
        description: 'Cuando Jorge aprueba una creatividad de imagen en NORA, el frontend crea automáticamente una nueva creatividad con origen=Pantalla, estado=para_procesamiento, condicion=requerido. Copia el prompt original (3:4) y los textos. El prompt aún no está adaptado a 16:9.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca', 'estado → para_procesamiento', 'condicion → requerido',
                'origen → Pantalla',
                'prompt → copiado de la creatividad origen (aún vertical)',
                'gatillador → "Pantalla 16:9 desde creatividad #N"',
                'slogan_headline', 'subtitulo', 'cta',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Jorge aprueba creatividad de imagen',
            resource: { type: 'usuario', name: 'NORA Dashboard' },
            description: 'Al aprobar una creatividad t2i, NORA crea automáticamente la versión Pantalla.',
          },
          {
            label: 'INSERT creatividad Pantalla',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'NORA crea la creatividad directamente en Supabase con prompt copiado y textos heredados.',
            details: [
              'estado → para_procesamiento',
              'condicion → requerido',
              'origen → Pantalla',
              'prompt → copiado (aún dice "Vertical format")',
              'slogan_headline, subtitulo, cta → heredados',
            ],
            stateChange: 'NULL → para_procesamiento (condicion: requerido)',
          },
        ],
      },

      lectura: {
        title: 'Creatividad Pantalla pendiente + marca',
        executor: 'skill',
        executorDetail: 'nora-creatividad-pantalla',
        stateIn: 'para_procesamiento',
        stateOut: null,
        description: 'Detecta creatividades Pantalla en para_procesamiento y lee la ficha de marca para adaptar la composición.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'slogan_headline', 'subtitulo', 'cta', 'gatillador'],
            marcas: ['paleta_colores', 'look_and_feel', 'notas_generales', 'contenido_prohibido'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Detectar creatividades Pantalla pendientes',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Busca creatividades con estado=para_procesamiento, origen=Pantalla, condicion=requerido.',
            filter: 'estado = para_procesamiento AND origen = Pantalla AND condicion = requerido',
          },
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Paleta, look & feel, notas y restricciones para mantener coherencia en la adaptación.',
            filter: 'marca = {marca}',
          },
        ],
      },

      procesamiento: {
        title: 'Adaptar prompt a 16:9 + UPDATE',
        executor: 'skill',
        executorDetail: 'nora-creatividad-pantalla',
        stateIn: 'para_procesamiento',
        stateOut: 'para_ejecucion',
        description: 'Adapta el prompt de composición vertical (3:4) a horizontal (16:9): redistribuye elementos, aprovecha el ancho. La creatividad ya existe (creada por NORA), se hace UPDATE.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              update: [
                'prompt → adaptado a composición 16:9 horizontal',
                'estado → para_ejecucion (transición desde para_procesamiento)',
                'condicion → null (limpia "requerido")',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Adaptar prompt a composición horizontal',
            resource: { type: 'skill', name: 'nora-creatividad-pantalla' },
            description: 'Reescribe el prompt para formato 16:9: redistribuir elementos horizontalmente, aprovechar ancho extra, mantener esencia visual.',
            details: [
              'Cambiar "Vertical format" → "Horizontal format, landscape, wide 16:9 composition"',
              'Redistribuir foreground/midground/background para el ancho',
              'Mantener espacio para texto adaptado al formato horizontal',
              'Misma paleta, misma atmósfera, mismo concepto',
            ],
          },
          {
            label: 'Actualizar creatividad (UPDATE)',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Sobreescribe el prompt con la versión adaptada a 16:9. Transiciona estado.',
            details: [
              'prompt → versión horizontal',
              'estado → para_ejecucion',
              'condicion → null',
            ],
            stateChange: 'para_procesamiento → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto — 1920×1080',
        executor: 'script',
        executorDetail: 'comfy-text2img.mjs --res=1920x1080',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'Mismo script comfy-text2img.mjs con --res=1920x1080. Marca en_proceso, envía workflow con resolución 16:9, espera y descarga.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = Pantalla'],
        },
        steps: [
          {
            label: 'Leer creatividad pendiente',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Query con estado para_ejecucion y origen pantalla.',
            filter: 'estado = para_ejecucion AND origen = Pantalla',
          },
          {
            label: 'Enviar workflow a ComfyUI (16:9)',
            resource: { type: 'script', name: 'comfy-text2img.mjs --res=1920x1080 → POST /prompt' },
            description: 'Mismo workflow Qwen pero con resolución 1920×1080 (16:9).',
            details: [
              'Modelo: Qwen 2.5 VL 7B (GGUF Q4_K_M)',
              'LoRA: Lightning 4-steps V1.0',
              'Sampler: euler, scheduler: simple, steps: 15, cfg: 1.5',
              'Resolución: 1920×1080 (16:9)',
            ],
          },
          {
            label: 'Esperar generación',
            resource: { type: 'script', name: 'comfy-text2img.mjs → poll /history' },
            description: 'Polling cada 3s hasta que aparezca el output.',
          },
          {
            label: 'Descargar imagen',
            resource: { type: 'script', name: 'comfy-text2img.mjs → GET /view' },
            description: 'Descarga la imagen 1920×1080 como buffer.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~3 min/imagen (16:9 más píxeles)' },
          { icon: '📐', label: 'Resolución', value: '1920×1080 (16:9)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-text2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'ejecutado',
        description: 'La imagen 16:9 se sube a Supabase Storage y se actualiza la creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_t2i_{timestamp}.png → bucket creatividades'],
            creatividades: {
              update: ['link_ren_1 → URL pública imagen 16:9', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir imagen a Storage',
            resource: { type: 'supabase', name: 'INSERT storage', op: 'INSERT' },
            description: 'Upload al bucket "creatividades".',
            details: ['Nombre: {marca}_t2i_{timestamp}.png'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra la URL y cambia el estado.',
            stateChange: 'para_ejecucion → ejecutado',
          },
        ],
      },

      observacion: {
        title: 'Observación humana → corrección',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        optional: true,
        manual: true,
        stateIn: 'observado',
        stateOut: 'para_ejecucion (nuevas) / para_revision (solo textos)',
        description: 'Jorge revisa en NORA y deja observación si necesita ajustes. NO sujeta a iteración automática — solo observaciones manuales.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'observacion', 'condicion', 'link_ren_1'],
            marcas: ['paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_textos: ['condicion → para_revision'],
              insert_imagen: ['nuevas creatividades con prompt corregido, estado → para_ejecucion'],
            },
          },
          filters: ['observacion NOT NULL', 'condicion = observado', 'origen = Pantalla'],
        },
        steps: [
          {
            label: 'Detectar + interpretar observación',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Clasifica tipo de cambio y actúa.',
          },
          {
            label: 'Corregir según observación',
            resource: { type: 'supabase', name: 'INSERT/UPDATE creatividades', op: 'INSERT' },
            description: 'Duplica con prompt corregido o edita textos directo.',
          },
        ],
        meta: [
          { icon: '👁️', label: 'Trigger', value: 'Jorge deja observación en NORA → condicion=observado' },
          { icon: '⚠️', label: 'Sin QA auto', value: 'Pantalla NO pasa por iteración automática' },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline 5b: Pantalla · Colaborador (img2img 16:9 con pad blanco)
  // ============================================================
  {
    id: 'pantalla-colaborador',
    title: 'Pantalla · Colaborador',
    subtitle: '16:9 para TVs — adapta fotos aprobadas (img2img con pad blanco)',
    command: '/nora-creatividad-pantalla',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'nora',
        label: 'NORA: aprobación → crear versión Pantalla',
        phases: ['activador'],
        handoff: 'creatividad en Supabase (con url de foto)',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-creatividad-pantalla',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-img2img.mjs --res=1920x1080 --upscale',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision',
      },
      {
        executor: 'skill',
        label: 'QA Humano: nora-imagen-observacion',
        phases: ['observacion'],
        optional: true,
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'NORA crea versión Pantalla al aprobar img2img',
        executor: 'nora',
        stateIn: null,
        stateOut: 'para_procesamiento',
        description: 'Cuando Jorge aprueba una creatividad img2img (Colaborador/Producto/Interior/Exterior/Fachada), NORA crea automáticamente una nueva creatividad con origen=Pantalla, estado=para_procesamiento, condicion=requerido. Copia la url de la foto original y el prompt de edición.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca', 'estado → para_procesamiento', 'condicion → requerido',
                'origen → Pantalla',
                'url → foto original de la creatividad img2img',
                'prompt → copiado de la creatividad origen (edición vertical)',
                'gatillador → "Pantalla 16:9 desde creatividad #N"',
                'slogan_headline', 'subtitulo', 'cta',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Jorge aprueba creatividad img2img',
            resource: { type: 'usuario', name: 'NORA Dashboard' },
            description: 'Al aprobar una creatividad img2img, NORA crea automáticamente la versión Pantalla.',
          },
          {
            label: 'INSERT creatividad Pantalla (con url)',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'NORA crea la creatividad con url de foto + prompt de edición copiado.',
            details: [
              'estado → para_procesamiento',
              'condicion → requerido',
              'origen → Pantalla',
              'url → foto original (Colaborador/Producto/etc)',
              'prompt → copiado (prompt de edición aún vertical)',
              'slogan_headline, subtitulo, cta → heredados',
            ],
            stateChange: 'NULL → para_procesamiento (condicion: requerido)',
          },
        ],
      },

      lectura: {
        title: 'Creatividad Pantalla pendiente (con foto) + marca',
        executor: 'skill',
        executorDetail: 'nora-creatividad-pantalla',
        stateIn: 'para_procesamiento',
        stateOut: null,
        description: 'Detecta creatividades Pantalla con url (foto) en para_procesamiento y lee la ficha de marca para adaptar el prompt de edición.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'url', 'slogan_headline', 'subtitulo', 'cta', 'gatillador'],
            marcas: ['paleta_colores', 'look_and_feel', 'notas_generales', 'contenido_prohibido'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Detectar creatividades Pantalla con foto',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Busca creatividades con estado=para_procesamiento, origen=Pantalla, condicion=requerido, url NOT NULL.',
            filter: 'estado = para_procesamiento AND origen = Pantalla AND condicion = requerido AND url NOT NULL',
          },
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Paleta, look & feel, notas y restricciones para mantener coherencia.',
            filter: 'marca = {marca}',
          },
        ],
      },

      procesamiento: {
        title: 'Adaptar prompt de edición a 16:9 + UPDATE',
        executor: 'skill',
        executorDetail: 'nora-creatividad-pantalla',
        stateIn: 'para_procesamiento',
        stateOut: 'para_ejecucion',
        description: 'Adapta el prompt de edición para que Qwen rellene los espacios blancos laterales del pad con el entorno descrito. La foto se cropea al alto del canvas 16:9 (928px) sin redimensionar, se centra en canvas 1664×928 (resolución oficial Qwen, ambos ÷16) con padding blanco, Qwen genera el contenido de los bordes, y ESRGAN x4 upscalea a 1920×1080.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              update: [
                'prompt → adaptado a edición horizontal 16:9 (rellenar bordes)',
                'estado → para_ejecucion (transición desde para_procesamiento)',
                'condicion → null (limpia "requerido")',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Adaptar prompt de edición a 16:9',
            resource: { type: 'skill', name: 'nora-creatividad-pantalla' },
            description: 'Reescribe el prompt para que Qwen rellene las zonas blancas laterales del pad con entorno coherente.',
            details: [
              'La foto se cropea a 928px de alto (sin resize) y se centra en canvas 1664×928 con pad blanco',
              'Qwen interpreta los blancos como áreas a rellenar',
              'El prompt describe el entorno a extender lateralmente',
              'Mantener la persona/producto intacta en el centro',
            ],
          },
          {
            label: 'Actualizar creatividad (UPDATE)',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Sobreescribe el prompt con la versión de edición horizontal.',
            details: [
              'prompt → versión edición horizontal',
              'estado → para_ejecucion',
              'condicion → null',
            ],
            stateChange: 'para_procesamiento → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto — crop+pad 1664×928 → ESRGAN x4 → 1920×1080',
        executor: 'script',
        executorDetail: 'comfy-img2img.mjs --res=1920x1080 --upscale',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'Script comfy-img2img.mjs con --res=1920x1080 --upscale. La foto se cropea a 928px de alto (sin resize), se centra en canvas 1664×928 (resolución oficial Qwen ÷16) con pad blanco, Qwen edita rellenando los espacios blancos, luego ESRGAN x4 upscalea a 6656×3712 y se redimensiona a 1920×1080 final.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'url'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = Pantalla', 'url NOT NULL'],
        },
        steps: [
          {
            label: 'Leer creatividad pendiente',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Query con estado para_ejecucion, origen Pantalla y url presente.',
            filter: 'estado = para_ejecucion AND origen = Pantalla AND url NOT NULL',
          },
          {
            label: 'Crop + pad 1664×928 + Qwen edit + ESRGAN x4 → 1920×1080',
            resource: { type: 'script', name: 'comfy-img2img.mjs --res=1920x1080 --upscale → POST /prompt' },
            description: 'Cropea foto a 928px de alto, centra en canvas 1664×928 con pad blanco, Qwen edita, ESRGAN x4 upscalea, resize lanczos a 1920×1080.',
            details: [
              'Nodo 141: LoadImage (foto original)',
              'Nodo 139: ImageResizeKJv2 crop center → {ancho_original}×928 (sin resize)',
              'Nodo 140: ImageResizeKJv2 pad white → 1664×928',
              'Nodo 104/113: TextEncodeQwenImageEdit (apunta a nodo padded)',
              'Nodo 109: VAEEncode (apunta a nodo padded)',
              'Modelo: Qwen Image Edit (fp8) + Lightning LoRA 4-steps',
              'Nodo 150: UpscaleModelLoader → ESRGAN_4x.pth',
              'Nodo 151: ImageUpscaleWithModel x4 → 6656×3712',
              'Nodo 152: ImageResizeKJv2 lanczos → 1920×1080 final',
            ],
          },
          {
            label: 'Esperar generación',
            resource: { type: 'script', name: 'comfy-img2img.mjs → poll /history' },
            description: 'Polling cada 3s hasta que aparezca el output.',
          },
          {
            label: 'Descargar imagen',
            resource: { type: 'script', name: 'comfy-img2img.mjs → GET /view' },
            description: 'Descarga la imagen 1920×1080 como buffer.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~2 min/imagen (img2img 4 steps)' },
          { icon: '📐', label: 'Resolución', value: 'crop+pad 1664×928 → ESRGAN x4 → 1920×1080' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-img2img.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'ejecutado',
        description: 'La imagen 16:9 se sube a Supabase Storage y se actualiza la creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_i2i_{timestamp}.png → bucket creatividades'],
            creatividades: {
              update: ['link_ren_1 → URL pública imagen 16:9', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir imagen a Storage',
            resource: { type: 'supabase', name: 'INSERT storage', op: 'INSERT' },
            description: 'Upload al bucket "creatividades".',
            details: ['Nombre: {marca}_i2i_{timestamp}.png'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra la URL y cambia el estado.',
            stateChange: 'para_ejecucion → ejecutado',
          },
        ],
      },

      observacion: {
        title: 'Observación humana → corrección',
        executor: 'skill',
        executorDetail: 'nora-imagen-observacion',
        optional: true,
        manual: true,
        stateIn: 'observado',
        stateOut: 'para_ejecucion (nuevas) / para_revision (solo textos)',
        description: 'Jorge revisa en NORA y deja observación si necesita ajustes. NO sujeta a iteración automática — solo observaciones manuales.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'prompt', 'concepto', 'observacion', 'condicion', 'link_ren_1', 'url'],
            marcas: ['paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {
            creatividades: {
              update_textos: ['condicion → para_revision'],
              insert_imagen: ['nuevas creatividades con prompt corregido, estado → para_ejecucion'],
            },
          },
          filters: ['observacion NOT NULL', 'condicion = observado', 'origen = Pantalla', 'url NOT NULL'],
        },
        steps: [
          {
            label: 'Detectar + interpretar observación',
            resource: { type: 'skill', name: 'nora-imagen-observacion' },
            description: 'Clasifica tipo de cambio y actúa.',
          },
          {
            label: 'Corregir según observación',
            resource: { type: 'supabase', name: 'INSERT/UPDATE creatividades', op: 'INSERT' },
            description: 'Duplica con prompt corregido o edita textos directo.',
          },
        ],
        meta: [
          { icon: '👁️', label: 'Trigger', value: 'Jorge deja observación en NORA → condicion=observado' },
          { icon: '⚠️', label: 'Sin QA auto', value: 'Pantalla NO pasa por iteración automática' },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline 6: Text-to-Video UGC (LTX-Video 2 + Cartesia TTS)
  // ============================================================
  {
    id: 'text2video-ugc',
    title: 'Text-to-Video · UGC',
    subtitle: 'Video testimonial con voz Cartesia TTS + LTX-Video 2.3',
    command: '/nora-video-ugc',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'usuario',
        label: 'Usuario',
        phases: ['activador'],
        handoff: 'invoca skill',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-video-ugc',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-t2v-ugc.mjs',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad para_revision → espera aprobación',
      },
      {
        executor: 'usuario',
        label: 'Revisión humana',
        phases: ['observacion'],
        handoff: 'aprueba creatividad → post-producción',
      },
      {
        executor: 'script',
        label: 'Script: postprod-ugc.mjs',
        phases: ['postprod', 'entrega_final'],
        handoff: 'creatividad final con subs + pack',
      },
    ],

    phases: {
      activador: {
        title: 'Instrucción directa',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /nora-video-ugc indicando la marca. Se cargan las variables de entorno.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario indica marca, tipo de personaje, ángulo emocional y dirección creativa.',
            details: [
              'marca — Nombre exacto en Supabase (obligatorio)',
              'personaje — Descripción física (edad, pelo, complexión)',
              'escenario — boardroom, cowork, seamless, etc.',
              'ángulo — Qué dolor/beneficio comunicar',
            ],
          },
          {
            label: 'Cargar variables de entorno',
            resource: { type: 'env', name: '.env' },
            description: 'Se exportan las variables del archivo .env del proyecto.',
            details: [
              'SUPABASE_URL',
              'SUPABASE_SERVICE_ROLE_KEY',
              'COMFY_URL',
              'CARTESIA_API_KEY',
            ],
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca',
        executor: 'skill',
        executorDetail: 'nora-video-ugc',
        stateIn: null,
        stateOut: null,
        description: 'Se lee la ficha completa de la marca para generar un concepto y libreto coherentes.',
        supabaseFields: {
          reads: {
            marcas: ['ficha', 'arquetipo', 'buyer_persona', 'notas_generales', 'contenido_prohibido'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'Ficha completa: identidad, arquetipo, buyer_persona, paleta, look & feel.',
            details: [
              'ficha — contexto estratégico',
              'arquetipo — personalidad de marca',
              'buyer_persona — público objetivo',
              'notas_generales — reglas específicas',
              'contenido_prohibido — filtro negativo',
            ],
            filter: 'marca = {marca}',
          },
        ],
      },

      procesamiento: {
        title: 'Concepto + Libreto + Voz + Prompt + INSERT',
        executor: 'skill',
        executorDetail: 'nora-video-ugc',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: '5 sub-pasos: concepto UGC, libreto (~15-20 palabras), voz Cartesia TTS (WAV), prompt LTX, INSERT creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_ugc_audio_{timestamp}.wav → bucket creatividades (audio Cartesia)'],
            creatividades: {
              insert: [
                'marca', 'estado → para_ejecucion', 'origen → ugc', 'condicion → null',
                'prompt → texto LTX en inglés', 'url → audio WAV en Storage',
                'concepto', 'slogan_headline', 'copy',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Concepto UGC',
            resource: { type: 'skill', name: 'nora-video-ugc' },
            description: 'Definir escenario, personaje, ángulo emocional y tipo de cámara.',
            details: [
              'Escenario: boardroom (MEJOR), cowork, seamless, bodega',
              'Personaje: edad, pelo, barba, complexión',
              'Ángulo: dolor que resuelve, beneficio que destaca',
              'Cámara: dolly-in sutil, cámara fija, tracking',
            ],
          },
          {
            label: 'Escribir libreto',
            resource: { type: 'skill', name: 'nora-video-ugc' },
            description: 'Texto de 15-20 palabras (~4-5 segundos). Hook → Beneficio → CTA.',
          },
          {
            label: 'Generar voz Cartesia TTS',
            resource: { type: 'api', name: 'Cartesia Sonic 3' },
            description: 'Genera WAV 44100Hz mono via API. Sube a Supabase Storage. El script añade 1s de silencio al final automáticamente.',
            details: [
              'Modelo: sonic-3',
              'Voces: 6 voces chilenas — Joven: Oliver/Alanys · Adulto: Tono Mo/Karla K · Adulto Mayor: Héctor/Gabriela',
              'Speed: 0.9-1.05 según marca',
              'Formato: WAV 44100Hz mono',
              'Silencio final: +1s automático (ffmpeg apad) — transición a pack de cierre',
              'Guía: skill nora-voz-cartesia',
            ],
          },
          {
            label: 'Construir prompt LTX',
            resource: { type: 'skill', name: 'nora-prompt-ltxvideo' },
            description: 'Párrafo fluido en inglés, 4-8 oraciones. Template UGC validado.',
            details: [
              'Sujeto → Acción → Cámara → Lente → Iluminación → Fondo → Color → Detalles',
              'Cierre: personaje deja de hablar y sonríe a cámara (coincide con 1s silencio)',
              'Negativos base siempre incluidos',
              'Entorno real con bokeh >> studio seamless',
            ],
          },
          {
            label: 'Insertar creatividad',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Creatividad con prompt, audio URL y campos de copy.',
            details: [
              'estado: para_ejecucion',
              'origen: ugc',
              'prompt: texto LTX en inglés',
              'url: audio WAV en Supabase Storage',
              'concepto, slogan_headline, copy',
            ],
            stateChange: 'NULL → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto — LTX-Video 2.3 + RTX Upscale',
        executor: 'script',
        executorDetail: 'comfy-t2v-ugc.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'El script marca en_proceso, descarga el audio, lo sube a ComfyUI, envía el workflow LTX 2.3, espera el video, mergea audio, aplica RTX upscale x2 y lo descarga. Si falla, marca como error.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'url', 'concepto'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = ugc', 'prompt NOT NULL', 'url NOT NULL'],
        },
        steps: [
          {
            label: 'Descargar audio + pad silencio',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → fetch audio + ffmpeg apad' },
            description: 'Descarga WAV desde Supabase y añade 1s de silencio al final (ffmpeg apad). El silencio permite que el personaje sonría a cámara antes del pack de cierre.',
          },
          {
            label: 'Subir audio a ComfyUI',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → POST /upload/image' },
            description: 'ComfyUI acepta WAV en /upload/image. El nodo LoadAudio lo carga por nombre.',
          },
          {
            label: 'Enviar workflow LTX 2.3',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → POST /prompt' },
            description: 'Workflow LTX 2.3 con audio lip-sync nativo + SaveLatent.',
            details: [
              'Modelo: ltx-2-3-22b-dev-Q4_K_M.gguf',
              'CLIP: gemma-3-12b-it-IQ4_XS.gguf + ltx-2.3_text_projection',
              'LoRA distilled (0.5) — 1 sola LoRA',
              'Sampler: euler_ancestral_cfg_pp, 8 steps, CFG 1.0',
              'Resolución: 576×1024 (9:16), 24fps',
              'Audio: MelBandRoFormer → LTXVAudioVAEEncode (mask=0)',
              'SaveLatent: ugc_{id}_latent en PC-2 (backup)',
            ],
          },
          {
            label: 'Esperar generación LTX',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → poll /history' },
            description: 'Polling cada 5s hasta output en /history. Timeout 15 min.',
            details: [
              'Busca outputs["800"].gifs[0] (VHS_VideoCombine)',
              'Si status_str = error → falla',
            ],
          },
          {
            label: 'Descargar video + merge audio',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → GET /view + ffmpeg' },
            description: 'Descarga MP4 (576×1024) y mergea audio Cartesia original.',
          },
          {
            label: 'RTX Video SuperResolution x2',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → POST /upload/image + POST /prompt' },
            description: 'Sube video mergeado a ComfyUI y ejecuta workflow RTX upscale (NVIDIA TensorRT).',
            details: [
              'Workflow: workflows/rtx-video-upscale.json (5 nodos)',
              'LoadVideo → GetVideoComponents → RTXVideoSuperResolution → CreateVideo → SaveVideo',
              'Scale: x2, Quality: ULTRA',
              '576×1024 → 1152×2048',
              'Preserva audio original (no re-encode)',
              '~26 segundos',
            ],
          },
          {
            label: 'Esperar RTX upscale',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → poll /history' },
            description: 'Polling cada 5s. Timeout 10 min. Output key: outputs["9"].images[0] (SaveVideo).',
          },
          {
            label: 'Descargar video upscaleado',
            resource: { type: 'script', name: 'comfy-t2v-ugc.mjs → GET /view' },
            description: 'Descarga MP4 upscaleado (1152×2048) desde ComfyUI.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~10 min/video (LTX ~9 min + RTX ~26s)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 1 video por corrida (VRAM leak)' },
          { icon: '🔎', label: 'Upscale', value: 'RTX TensorRT x2 ULTRA inline (576→1152)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-t2v-ugc.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'base_lista',
        description: 'El video upscaleado (1152×2048) con audio se sube a Supabase Storage y se actualiza la creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_ugc_{timestamp}.mp4 → bucket creatividades (video upscaleado 1152×2048)'],
            creatividades: {
              update: ['link_ren_1 → URL pública video upscaleado', 'link_ren_2 → URL pública video upscaleado', 'estado → base_lista', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir video upscaleado a Storage',
            resource: { type: 'supabase', name: 'INSERT storage', op: 'INSERT' },
            description: 'Upload del video upscaleado (1152×2048) al bucket "creatividades".',
            details: ['Nombre: creatividades/{marca}_ugc_{timestamp}.mp4'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra la URL del video upscaleado y cambia el estado.',
            details: [
              'link_ren_1 → URL pública del video upscaleado 1152×2048',
              'link_ren_2 → URL pública del video upscaleado 1152×2048',
              'estado → base_lista',
              'condicion → para_revision',
            ],
            stateChange: 'para_ejecucion → base_lista',
          },
        ],
      },

      postprod: {
        title: 'Post-producción Remotion (Whisper + subs + pack)',
        executor: 'script',
        executorDetail: 'postprod-ugc.mjs',
        stateIn: 'aprobado',
        stateOut: null,
        description: 'Tras aprobación humana: descarga video upscaleado (1152×2048), Remotion escala a 1080p. Transcribe audio (Whisper CUDA), render dual (9:16 + 4:5) con subtítulos karaoke y pack de cierre. Flags: --subs-bottom, --subs-right, --no-gradient, --remove-words=N.',
        manual: true,
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'link_ren_1', 'link_ren_2', 'url', 'prompt', 'concepto', 'copy', 'slogan_headline'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Descargar video base + audio',
            resource: { type: 'script', name: 'postprod-ugc.mjs → fetch' },
            description: 'Descarga video upscaleado 1152×2048 (link_ren_1) y audio (url). Remotion escala a 1080p en render.',
          },
          {
            label: 'Copiar assets a PC-2',
            resource: { type: 'script', name: 'postprod-ugc.mjs → scp' },
            description: 'SCP: video + audio → remotion-nora/public/videos/ y public/audio/ en PC-2.',
          },
          {
            label: 'Transcribir con Whisper',
            resource: { type: 'script', name: 'postprod-ugc.mjs → ssh whisper' },
            description: 'Whisper small en PC-2 (CUDA). Output: JSON con timestamps word-by-word.',
            details: [
              'Modelo: small (español, v20250625)',
              '--word_timestamps True',
              'Output: JSON con start/end por palabra',
            ],
          },
          {
            label: 'Generar TSX dedicado',
            resource: { type: 'script', name: 'postprod-ugc.mjs → generateCompositionTsx' },
            description: 'Genera {Marca}UGC{ID}.tsx + Feed.tsx con subtítulos hardcodeados. Actualiza Root.tsx.',
            details: [
              'Patrón: {Marca}UGC{ID}.tsx (no inputProps genéricos)',
              'Karaoke word-level: ~5 palabras/grupo, 3f gap',
              'Font: 60px (9:16), 50px (4:5) — Montserrat 700',
              'Posición subs: 9:16 arriba (default) o --subs-bottom. 4:5 siempre abajo.',
              '--subs-right: alinear subtítulos a la derecha (variación entre videos)',
              '--no-gradient: sin degradado detrás de subs',
              '--remove-words=N: eliminar palabras de Whisper por índice',
              'Whisper fixes: mapa WHISPER_FIXES para errores comunes (paddle→pádel, Centra→Cemtra, doctor→Doctor)',
              'Poster frame: frame 60, primera frase visible',
              'Pack de cierre: logo + URL por marca (PACK_PROPS), URL 50px',
            ],
          },
          {
            label: 'Render 9:16 + 4:5',
            resource: { type: 'script', name: 'postprod-ugc.mjs → ssh remotion render' },
            description: 'Remotion render dual: 1080×1920 (9:16) + 1080×1350 (4:5, objectFit cover).',
          },
          {
            label: 'Verificar audio',
            resource: { type: 'script', name: 'postprod-ugc.mjs → ssh ffmpeg volumedetect' },
            description: 'mean_volume entre -5 y -30 dB.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB (Whisper CUDA + Remotion)' },
          { icon: '⏱️', label: 'Tiempo', value: '~3-5 min (whisper ~30s + 2 renders ~2min c/u)' },
          { icon: '🎬', label: 'Output', value: '2 videos: 1080×1920 (9:16) + 1080×1350 (4:5)' },
          { icon: '📐', label: 'Escala', value: 'Remotion escala 1152→1080p (video ya upscaleado por RTX)' },
          { icon: '🎵', label: 'Pack cierre', value: 'crossfade=0, entra después del video. Audio limitado a videoFrames.' },
          { icon: '🔤', label: 'Subtítulos', value: 'Karaoke word-level, spacing 18px, Montserrat Bold 60/50px. --subs-right disponible.' },
        ],
      },

      entrega_final: {
        title: 'Upload dual + creatividad final',
        executor: 'script',
        executorDetail: 'postprod-ugc.mjs',
        stateIn: null,
        stateOut: 'ejecutado',
        description: 'Sube ambos videos a Supabase Storage y crea creatividad nueva con link_ren_1 (4:5) y link_ren_2 (9:16).',
        supabaseFields: {
          reads: {},
          writes: {
            storage: [
              '{marca}_ugc_{timestamp}_916.mp4 → bucket creatividades (9:16 stories)',
              '{marca}_ugc_{timestamp}_45.mp4 → bucket creatividades (4:5 feed)',
            ],
            creatividades: {
              insert: [
                'marca', 'estado → ejecutado', 'origen → ugc', 'condicion → para_revision',
                'link_ren_1 → video 4:5 (feed)', 'link_ren_2 → video 9:16 (stories)',
                'prompt, concepto, copy, slogan_headline → heredados de creatividad base',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Descargar renders de PC-2',
            resource: { type: 'script', name: 'postprod-ugc.mjs → scp' },
            description: 'SCP inverso: out/video_916.mp4 + out/video_45.mp4 → Mac local.',
          },
          {
            label: 'Upload video 9:16',
            resource: { type: 'supabase', name: 'UPSERT storage', op: 'UPSERT' },
            description: 'creatividades/{marca}_ugc_{id}_916.mp4 → link_ren_2 (PUT x-upsert)',
          },
          {
            label: 'Upload video 4:5',
            resource: { type: 'supabase', name: 'UPSERT storage', op: 'UPSERT' },
            description: 'creatividades/{marca}_ugc_{id}_45.mp4 → link_ren_1 (PUT x-upsert)',
          },
          {
            label: 'Crear creatividad final',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Nueva creatividad con ambos links, hereda prompt/concepto/copy de la original.',
            details: [
              'link_ren_1 → 4:5 (feed)',
              'link_ren_2 → 9:16 (stories/TikTok)',
              'origen: ugc',
              'condicion: para_revision',
            ],
            stateChange: 'NULL → ejecutado',
          },
        ],
      },
    },
  },
]


export const sharedDocs = [
  { name: 'SCHEMA.md', desc: 'Tablas, campos, tipos, enums' },
  { name: 'PIPELINE.md', desc: 'Flujo de estados y scripts' },
  { name: 'GUIA-TEXTOS.md', desc: 'Reglas de copy, headlines, CTAs' },
  { name: 'IDIOMA.md', desc: 'Reglas español/inglés' },
  { name: 'HERRAMIENTAS.md', desc: 'Tools disponibles (Bash, Supabase, ComfyUI)' },
  { name: 'SUPABASE.md', desc: 'URL, headers, encoding' },
]

export const phaseColors = [
  { id: 'trigger', label: 'Activador', cls: 'node-trigger' },
  { id: 'input', label: 'Datos', cls: 'node-input' },
  { id: 'support', label: 'Soporte', cls: 'node-support' },
  { id: 'gen', label: 'Generación', cls: 'node-gen' },
  { id: 'script', label: 'Motor', cls: 'node-script' },
  { id: 'step', label: 'Estado', cls: 'node-step' },
  { id: 'qa', label: 'QA', cls: 'node-qa' },
  { id: 'obs', label: 'Observación', cls: 'node-obs' },
]
