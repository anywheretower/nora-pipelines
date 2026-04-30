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
  // Pipeline 2.5: Cover · GPT-2 (upgrade con texto integrado vía ComfyUI Cloud)
  // ============================================================
  {
    id: 'text2img-gpt2-cover',
    title: 'Cover · GPT-2 (calidad agencia)',
    subtitle: 'Upgrade vía gpt-image-2 medium con texto baked-in y prompting en 6 bloques (artifact / exact text / layout / visual system / details / constraints) · 25 patrones de layout derivados de moodboard editorial · reglas globales: margen 10% bordes, vibrancia ≤15%, white balance 5600K, layered depth, una metáfora visual única · 1024×1536 (2:3) nativo · arquetipo + identidad de marca + contact strip flexible',
    command: '/nora-creatividad-cover --id=N',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'usuario',
        label: 'Usuario',
        phases: ['activador'],
        handoff: 'invoca skill con id source',
      },
      {
        executor: 'skill',
        label: 'Skill: nora-creatividad-cover',
        phases: ['lectura', 'procesamiento'],
        handoff: 'INSERT creatividad COVER con tags="parent:N", estado=para_ejecucion',
      },
      {
        executor: 'script',
        label: 'Script: comfy-cloud-t2i-gpt2.mjs',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad ejecutado / para_revision con link_ren_1',
      },
    ],

    phases: {
      activador: {
        title: 'Invocación con id source',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /nora-creatividad-cover --id=N indicando la creatividad source (origen original o referencia, ya aprobada por revisión humana). Permite batch con --ids=N,M,P.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'Indica el id de una creatividad existente que se quiere upgradear.',
            details: [
              '--id=N — un solo source (modo simple)',
              '--ids=N,M,P — batch (procesa hasta 4 por corrida del script)',
            ],
          },
          {
            label: 'Cargar variables de entorno',
            resource: { type: 'env', name: '.env' },
            description: 'COMFY_CLOUD_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
          },
        ],
      },

      lectura: {
        title: 'Validar source + lectura profunda de marca',
        executor: 'skill',
        executorDetail: 'nora-creatividad-cover',
        stateIn: null,
        stateOut: null,
        description: 'El skill valida elegibilidad del source y lee contexto profundo de la marca: identidad visual (HEX_LIST), arquetipo Mark/Pearson, ficha completa, redes_urls (web + IG + FB + LinkedIn) y contenido prohibido. Verifica covers previas para evitar duplicados.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'origen', 'condicion', 'prompt', 'concepto', 'slogan_headline', 'subtitulo', 'cta', 'copy', 'descripcion_corta', 'buyer_persona', 'dolor_anhelo', 'cambio_emocional', 'diferenciador', 'beneficios', 'objeciones_tipicas', 'link_ren_1', 'tags', 'gatillador'],
            marcas: ['identidad_visual', 'arquetipo', 'ficha', 'redes_urls', 'paleta_colores', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {},
          filters: ['source.origen IN (original, referencia)', 'source.condicion IN (para_revision, aprobado, resultado_final)', 'source.link_ren_1 NOT NULL', 'source.slogan_headline NOT NULL'],
        },
        steps: [
          {
            label: 'Validar elegibilidad del source',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Verificar origen, condicion, link_ren_1 y slogan_headline. Abortar con mensaje claro si no cumple.',
            filter: 'id = SOURCE_ID',
          },
          {
            label: 'Lectura profunda de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'identidad_visual canónico (HEX_LIST línea 1), arquetipo (mapeable a 5 visual cues concretos), ficha completa (de ahí se parsean teléfono y dirección), redes_urls (web + IG para contact strip), contenido_prohibido.',
          },
          {
            label: 'Anti-duplicado',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Buscar covers previas del mismo source: origen=COVER AND tags LIKE %parent:SOURCE_ID%. Si existe, pedir confirmación al usuario.',
          },
        ],
      },

      procesamiento: {
        title: 'Adaptar a 6 bloques + decidir contact strip + INSERT con reference',
        executor: 'skill',
        executorDetail: 'nora-creatividad-cover',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: 'El skill reescribe el prompt Qwen como prompt gpt-image-2 en 6 bloques etiquetados (artifact / exact text / layout / visual system / details / constraints), mapea el arquetipo a 5 visual cues concretos, decide flexiblemente si incluir un footer contact strip según saturación visual del parent, valida moderación y hace INSERT con tags="parent:N" + url=parent.link_ren_1 (reference image).',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca, origen=COVER, estado=para_ejecucion, condicion=null',
                'prompt (6 bloques etiquetados, comillas francesas «», anti-adjetivo emocional)',
                'slogan_headline (ALL CAPS), subtitulo, cta — truncados si excedían',
                'concepto, copy, descripcion_corta (con flag arquetipo + contact_strip)',
                'buyer_persona, dolor_anhelo, cambio_emocional, diferenciador, beneficios, objeciones_tipicas (copia del parent)',
                'tags = "parent:{SOURCE_ID}"',
                'url = parent.link_ren_1 ← reference image automática',
                'gatillador = "skill: nora-creatividad-cover (parent: {SOURCE_ID})"',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Truncar y normalizar textos',
            resource: { type: 'skill', name: 'nora-creatividad-cover · paso 4' },
            description: 'Headline ≤6 palabras ALL CAPS, subhead ≤8, CTA ≤3. Comillas francesas «». Si se trunca, registrar original en descripcion_corta.',
          },
          {
            label: 'Adaptar prompt en 6 bloques etiquetados',
            resource: { type: 'skill', name: 'nora-creatividad-cover · paso 5' },
            description: 'Estructura canónica: ARTIFACT / EXACT TEXT (verbatim, comillas francesas) / LAYOUT (rule of thirds, áreas seguras) / VISUAL SYSTEM (paleta only + tipografía descriptiva + iconografía + arquetipo cues) / DETAILS (luz/lente/materiales en hechos visuales) / CONSTRAINTS (preserve Spanish accents, no duplicate text, no invented logos).',
            details: [
              'Comillas francesas «» para texto en imagen (más estables que "")',
              'Keyword "only" en paleta reduce drift cromático ~40%',
              'Tipografía descriptiva: heavy condensed geometric sans / light humanist serif italic',
              'NO nombres de fonts comerciales (Helvetica/Futura) ni escuelas (Swiss/Bauhaus) — describir receta',
              'NO adjetivos emocionales (stunning/masterpiece/8K) — solo hechos visuales (50mm, 5600K, polished metallic)',
              'CONSTRAINTS obligatorio: preserve every Spanish accent á é í ó ú ñ',
            ],
          },
          {
            label: 'Mapear arquetipo Mark/Pearson → 5 visual cues',
            resource: { type: 'skill', name: 'nora-creatividad-cover · §A' },
            description: 'Tabla con los 12 arquetipos (Creator, Caregiver, Sage, Hero, Magician, Outlaw, Explorer, Innocent, Common Man, Lover, Joker, Ruler) traducidos a 3-5 visual cues concretos que gpt-image-2 reconoce. Si la marca no tiene arquetipo poblado, omitir esta sección.',
          },
          {
            label: 'Decidir contact strip por saturación visual',
            resource: { type: 'skill', name: 'nora-creatividad-cover · §C' },
            description: 'Heurística sobre el prompt Qwen original: si menciona "minimalist/clean studio/single subject/negative space" → SÍ contact strip. Si menciona "complex/multiple subjects/dense/cluttered" → NO. Default a NO en duda.',
            details: [
              'Si SÍ: footer band 8% al pie con web + IG + tel + ciudad (line icons + texto verbatim)',
              'Datos: redes_urls (web/IG) + regex sobre ficha (teléfono/dirección)',
              'Si falta cualquier dato → omitir esa línea, nunca inventar',
              'Si solo queda 1 dato → omitir el strip completo',
            ],
          },
          {
            label: 'Pre-check moderación',
            resource: { type: 'skill', name: 'nora-creatividad-cover · paso 7' },
            description: 'Validar contra contenido_prohibido de la marca + lista conocida moderation_blocked OpenAI (celebridades, IPs protegidas, símbolos sensibles). Logos de marca propia → NO pedir "draw the logo", usar reference image del parent.',
          },
          {
            label: 'INSERT creatividad COVER con reference image',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Nueva fila con origen=COVER, prompt adaptado, tags="parent:{id}", url=parent.link_ren_1 (CLAVE — el script lo usa como image input del nodo OpenAIGPTImage1 → modo edit que preserva composición/paleta/mood del parent).',
            stateChange: 'NULL → para_ejecucion',
          },
          {
            label: 'Reportar al usuario',
            resource: { type: 'skill', name: 'nora-creatividad-cover · paso 9' },
            description: 'Devolver id nuevo + comando del script + headline/sub/CTA finales + arquetipo aplicado + flag contact_strip + costo (~13 créditos / $0.058).',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI Cloud — gpt-image-2 con reference image',
        executor: 'script',
        executorDetail: 'comfy-cloud-t2i-gpt2.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'El script lee creatividades con origen=COVER en para_ejecucion. Si tienen url poblado (link_ren_1 del parent), descarga esa imagen, la sube al Cloud como input y la pasa al nodo OpenAIGPTImage1 como image input → modo edit que preserva composición/paleta/mood. Si no tiene url, modo text-only. Polling /api/job/{id}/status cada 3s. Si falla, marca estado=error con observacion=[auto] mensaje.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'url'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = COVER', 'prompt NOT NULL'],
        },
        steps: [
          {
            label: 'Marcar en_proceso',
            resource: { type: 'supabase', name: 'PATCH creatividades', op: 'UPDATE' },
            description: 'Previene doble pickup en ejecuciones concurrentes.',
            stateChange: 'para_ejecucion → en_proceso',
          },
          {
            label: 'Si url existe: subir reference image al Cloud',
            resource: { type: 'script', name: 'fetchReferenceBuffer + uploadFile' },
            description: 'GET sobre creatividad.url → buffer → POST /api/upload/image (type=input). Devuelve filename para referenciar desde el workflow.',
          },
          {
            label: 'Construir workflow Cloud',
            resource: { type: 'script', name: 'buildWorkflow(prompt, referenceFilename)' },
            description: '2-3 nodos comfy-core (sin ImageScale — output 1024×1536 nativo):',
            details: [
              '1: OpenAIGPTImage1 — model=gpt-image-2, quality=medium, size=1024x1536, n=1',
              '   + image=["10",0] si hay reference (modo edit con preservación)',
              '10: LoadImage — solo si reference filename presente',
              '3: SaveImage — filename_prefix=nora_gpt2cover (output 1024×1536 directo)',
            ],
          },
          {
            label: 'Submit a Cloud',
            resource: { type: 'script', name: 'POST /api/prompt' },
            description: 'Envío con extra_data.api_key_comfy_org para autenticar el nodo gpt-image-2 (créditos ComfyUI Cloud).',
          },
          {
            label: 'Poll job status',
            resource: { type: 'script', name: 'GET /api/job/{id}/status' },
            description: 'Cada 3s hasta completed/success o failed/error/cancelled. Reintentos 503 hasta 10 veces.',
            details: ['Timeout total: 10 minutos'],
          },
          {
            label: 'Descargar imagen',
            resource: { type: 'script', name: 'GET /api/history_v2/{id} + /api/view' },
            description: 'Lee el output del SaveImage y descarga el PNG vía /api/view con X-API-Key.',
          },
        ],
        meta: [
          { icon: '☁️', label: 'Backend', value: 'ComfyUI Cloud · cloud.comfy.org' },
          { icon: '🧠', label: 'Modelo', value: 'gpt-image-2 (versión más reciente del nodo OpenAIGPTImage1)' },
          { icon: '🎚️', label: 'Calidad', value: 'medium (siempre — costo predecible)' },
          { icon: '📐', label: 'Tamaño', value: '1024×1536 (2:3) nativo · sin crop ni rescale' },
          { icon: '🖼️', label: 'Reference image', value: 'creatividad.url → image input del nodo (modo edit que preserva composición del parent)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 4/run (consistente con resto de pipelines)' },
          { icon: '💳', label: 'Costo', value: '~13 créditos / ~$0.058 USD por cover (medium + reference image input)' },
          { icon: '🚫', label: 'QA exclusión', value: 'nora-imagen-iteracion NO procesa origen=COVER (criterios pensados para imágenes sin texto baked-in)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-cloud-t2i-gpt2.mjs',
        stateIn: 'en_proceso',
        stateOut: 'ejecutado',
        description: 'Sube el PNG al bucket creatividades y deja la creatividad lista para revisión humana.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_gpt2cover_{timestamp}.png → bucket creatividades'],
            creatividades: {
              update: ['link_ren_1 → URL pública', 'estado → ejecutado', 'condicion → para_revision'],
            },
          },
        },
        steps: [
          {
            label: 'Subir imagen a Storage',
            resource: { type: 'supabase', name: 'POST storage/v1/object/creatividades', op: 'INSERT' },
            description: 'Upload directo del buffer PNG.',
            details: ['Nombre: {marca}_gpt2cover_{timestamp}.png'],
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'PATCH creatividades', op: 'UPDATE' },
            description: 'Cierra el ciclo: estado=ejecutado, condicion=para_revision, link_ren_1=URL.',
            stateChange: 'en_proceso → ejecutado',
          },
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
        description: 'Tras aprobación humana: descarga video upscaleado (1152×2048), Remotion escala a 1080p. Transcribe audio (Whisper CUDA), render dual (9:16 + 4:5) con subtítulos karaoke y pack de cierre. Flags: --subs-bottom, --subs-right, --no-gradient, --remove-words=N, --video-pos="center 20%", --video-scale=1.03.',
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
              '--video-pos="center 20%": ajustar crop vertical en 4:5 (objectPosition)',
              '--video-scale=1.03: zoom sutil en 9:16',
              'Degradado: 30% alto en 9:16, 35% en 4:5 (no tapa cabeza)',
              'inputRange monotónico: fix automático si Whisper asigna mismo timestamp a grupos consecutivos',
              'Whisper fixes: WHISPER_FIXES para errores comunes (Messer→Meser, Centra→Cemtra, echo/Ecos→Equos, paddle→pádel, doctor→Doctor)',
              'Poster frame: frame 60, primera frase visible',
              'Pack de cierre: logo + URL por marca (PACK_PROPS), URL 50px',
            ],
          },
          {
            label: 'Render 9:16 + 4:5',
            resource: { type: 'script', name: 'postprod-ugc.mjs → ssh remotion render' },
            description: 'Remotion render dual: 1080×1920 (9:16) + 1080×1350 (4:5, objectFit cover, objectPosition configurable con --video-pos).',
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

  // Pipeline 7: Text-to-Video Pixar (LTX-Video 2.3 + Cartesia TTS, estilo animación 3D)
  // ============================================================
  {
    id: 'text2video-pixar',
    title: 'Text-to-Video · Pixar',
    subtitle: 'Video animado 3D estilo Pixar con voz Cartesia TTS + LTX-Video 2.3',
    command: '/nora-video-pixar',
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
        label: 'Skill: nora-video-pixar',
        phases: ['lectura', 'procesamiento'],
        handoff: 'ejecuta script via Bash',
      },
      {
        executor: 'script',
        label: 'Script: comfy-t2v-pixar.mjs',
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
        description: 'El usuario invoca /nora-video-pixar indicando la marca y dirección creativa. Contenido estilo Pixar: tierno, familiar, lúdico.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario indica marca, modalidad (personaje/objeto/escena) y dirección creativa.',
            details: [
              'marca — Nombre exacto en Supabase (obligatorio)',
              'modalidad — Personaje hablando, objeto animado, escena + voz en off',
              'escenario — Entorno 3D animado (bus, terminal, paisaje, hogar)',
              'tono — Tierno, lúdico, familiar, inspirador',
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
        executorDetail: 'nora-video-pixar',
        stateIn: null,
        stateOut: null,
        description: 'Se lee la ficha completa de la marca para generar un concepto y libreto coherentes con estilo Pixar.',
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
        title: 'Concepto + Libreto + Voz + Prompt Pixar + INSERT',
        executor: 'skill',
        executorDetail: 'nora-video-pixar',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: '5 sub-pasos: concepto Pixar (modalidad flexible), libreto corto (~15-25 palabras), voz Cartesia TTS (WAV, speed normal), prompt LTX estilo 3D animado, INSERT creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_pixar_audio_{timestamp}.wav → bucket creatividades (audio Cartesia)'],
            creatividades: {
              insert: [
                'marca', 'estado → para_ejecucion', 'origen → pixar', 'condicion → null',
                'prompt → texto LTX Pixar en inglés', 'url → audio WAV en Storage',
                'concepto', 'slogan_headline', 'copy',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Concepto Pixar',
            resource: { type: 'skill', name: 'nora-video-pixar' },
            description: 'Definir modalidad, escenario 3D, personaje/objeto animado y tono emocional.',
            details: [
              'Modalidad: personaje hablando, objeto animado, escena + voz en off',
              'Escenario: entornos 3D estilizados (bus colorido, terminal animada, paisaje)',
              'Personaje: rasgos Pixar (ojos grandes, features redondeados, expresivos)',
              'Tono: tierno, lúdico, familiar, inspirador',
            ],
          },
          {
            label: 'Escribir libreto',
            resource: { type: 'skill', name: 'nora-video-pixar' },
            description: 'Texto de 15-25 palabras (~5-8 segundos). Más corto y punch que UGC. Hook → Emoción → CTA.',
          },
          {
            label: 'Generar voz Cartesia TTS',
            resource: { type: 'api', name: 'Cartesia Sonic 3' },
            description: 'Genera WAV 44100Hz mono via API. Sube a Supabase Storage.',
            details: [
              'Modelo: sonic-3',
              'Voces prioritarias: Victor/Titi (niño), Oliver/Alanys/Vivi (joven) — tono lúdico',
              'Speed: "normal" (más energético que UGC)',
              'Formato: WAV 44100Hz mono',
              'Silencio final: +1s automático (ffmpeg apad)',
            ],
          },
          {
            label: 'Construir prompt LTX Pixar',
            resource: { type: 'skill', name: 'nora-prompt-ltxvideo' },
            description: 'Párrafo fluido en inglés con directivas de animación 3D. Sin terminología fotorrealista.',
            details: [
              'Prefix: 3D Pixar-style animated, CGI render, bright daylight, stylized features',
              'Sujeto → Acción → Escena → Expresión → Movimiento animado',
              'Suffix: vivid saturated colors, 4K sharpness, Pixar Dreamworks quality',
              'Negativos: live action, realistic, photographic, uncanny valley, low poly, flat shading',
              'NUNCA incluir: iPhone, ARRI, Kodak, ProRes, shallow depth of field',
            ],
          },
          {
            label: 'Insertar creatividad',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Creatividad con prompt Pixar, audio URL y campos de copy.',
            details: [
              'estado: para_ejecucion',
              'origen: pixar',
              'prompt: texto LTX Pixar en inglés',
              'url: audio WAV en Supabase Storage',
              'concepto, slogan_headline, copy',
            ],
            stateChange: 'NULL → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'ComfyUI remoto — LTX-Video 2.3 Pixar + RTX Upscale',
        executor: 'script',
        executorDetail: 'comfy-t2v-pixar.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'Mismo flujo que UGC pero con prompt wrapping Pixar, CFG 1.3, LoRA 0.3, y multipass por defecto. El script transforma el prompt automáticamente (salvo --raw).',
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
          filters: ['estado = para_ejecucion', 'origen = pixar', 'prompt NOT NULL', 'url NOT NULL'],
        },
        steps: [
          {
            label: 'Descargar audio + pad silencio',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → fetch audio + ffmpeg apad' },
            description: 'Descarga WAV desde Supabase y añade 1s de silencio al final.',
          },
          {
            label: 'Subir audio a ComfyUI',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → POST /upload/image' },
            description: 'ComfyUI acepta WAV en /upload/image.',
          },
          {
            label: 'Enviar workflow LTX 2.3 (Pixar)',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → POST /prompt' },
            description: 'Workflow LTX 2.3 con prompt wrapping Pixar + audio lip-sync + multipass 3 pasos.',
            details: [
              'Modelo: ltx-2-3-22b-dev-Q4_K_M.gguf',
              'LoRA distilled: 0.3 (reducida para no competir con estilo Pixar)',
              'Sampler: euler_ancestral_cfg_pp, CFG 1.3',
              'Multipass: ON por defecto (8 + 6 + 4 steps)',
              'Resolución: 576×1024 (9:16), 24fps',
              'Prompt wrapping: prefix + suffix Pixar automático',
              'SaveLatent: pixar_{id}_latent en PC-2',
            ],
          },
          {
            label: 'Esperar generación LTX',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → poll /history' },
            description: 'Polling cada 5s hasta output. Timeout 15 min. Más largo con multipass (~15-20 min).',
          },
          {
            label: 'Descargar video + merge audio',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → GET /view + ffmpeg' },
            description: 'Descarga MP4 (576×1024) y mergea audio Cartesia original.',
          },
          {
            label: 'RTX Video SuperResolution x2',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → RTX upscale' },
            description: 'Sube video a ComfyUI y ejecuta RTX upscale NVIDIA TensorRT.',
            details: [
              'Scale: x2, Quality: ULTRA',
              '576×1024 → 1152×2048',
              '~26 segundos',
            ],
          },
          {
            label: 'Esperar RTX upscale',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → poll /history' },
            description: 'Polling cada 5s. Timeout 10 min.',
          },
          {
            label: 'Descargar video upscaleado',
            resource: { type: 'script', name: 'comfy-t2v-pixar.mjs → GET /view' },
            description: 'Descarga MP4 upscaleado (1152×2048) desde ComfyUI.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 16GB, 192.168.1.26:8188' },
          { icon: '⏱️', label: 'Tiempo', value: '~15-20 min/video (multipass default + RTX ~26s)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 1 video por corrida (VRAM leak)' },
          { icon: '🎨', label: 'Estilo', value: 'Prompt wrapping Pixar + CFG 1.3 + LoRA 0.3' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'comfy-t2v-pixar.mjs',
        stateIn: 'para_ejecucion',
        stateOut: 'base_lista',
        description: 'El video upscaleado (1152×2048) con audio se sube a Supabase Storage y se actualiza la creatividad.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['{marca}_pixar_{timestamp}.mp4 → bucket creatividades (video upscaleado 1152×2048)'],
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
            details: ['Nombre: creatividades/{marca}_pixar_{timestamp}.mp4'],
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
        description: 'Reutiliza postprod-ugc.mjs tal cual. Tras aprobación: Whisper + subtítulos karaoke + pack de cierre + render dual.',
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
            description: 'Descarga video upscaleado 1152×2048 (link_ren_1) y audio (url).',
          },
          {
            label: 'Copiar assets a PC-2',
            resource: { type: 'script', name: 'postprod-ugc.mjs → scp' },
            description: 'SCP: video + audio → remotion-nora/public/ en PC-2.',
          },
          {
            label: 'Transcribir con Whisper',
            resource: { type: 'script', name: 'postprod-ugc.mjs → ssh whisper' },
            description: 'Whisper small en PC-2 (CUDA). Output: JSON con timestamps word-by-word.',
          },
          {
            label: 'Generar TSX + render dual',
            resource: { type: 'script', name: 'postprod-ugc.mjs → Remotion' },
            description: 'Genera composiciones TSX, render 1080×1920 (9:16) + 1080×1350 (4:5) con subs karaoke y pack de cierre.',
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
          { icon: '🔤', label: 'Subtítulos', value: 'Karaoke word-level, Montserrat Bold 60/50px' },
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
              '{marca}_pixar_{timestamp}_916.mp4 → bucket creatividades (9:16 stories)',
              '{marca}_pixar_{timestamp}_45.mp4 → bucket creatividades (4:5 feed)',
            ],
            creatividades: {
              insert: [
                'marca', 'estado → ejecutado', 'origen → pixar', 'condicion → para_revision',
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
            description: 'SCP inverso: videos renderizados → Mac local.',
          },
          {
            label: 'Upload video 9:16',
            resource: { type: 'supabase', name: 'UPSERT storage', op: 'UPSERT' },
            description: 'creatividades/{marca}_pixar_{id}_916.mp4 → link_ren_2 (PUT x-upsert)',
          },
          {
            label: 'Upload video 4:5',
            resource: { type: 'supabase', name: 'UPSERT storage', op: 'UPSERT' },
            description: 'creatividades/{marca}_pixar_{id}_45.mp4 → link_ren_1 (PUT x-upsert)',
          },
          {
            label: 'Crear creatividad final',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Nueva creatividad con ambos links, hereda prompt/concepto/copy de la original.',
            details: [
              'link_ren_1 → 4:5 (feed)',
              'link_ren_2 → 9:16 (stories/TikTok)',
              'origen: pixar',
              'condicion: para_revision',
            ],
            stateChange: 'NULL → ejecutado',
          },
        ],
      },
    },
  },

  // ─── CARRUSEL INSTAGRAM ───────────────────────────────────────────
  {
    id: 'carrusel',
    title: 'Carrusel',
    subtitle: 'Slides HTML swipeable → Playwright PNG 1080×1350 → Supabase → GetLate',
    command: '/carrusel',
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
        label: 'Skill: carrusel',
        phases: ['lectura', 'procesamiento', 'ejecucion'],
        handoff: 'slides PNG en directorio local',
      },
      {
        executor: 'script',
        label: 'Script: carrusel-upload.js',
        phases: ['entrega'],
        handoff: 'carrusel listo → revisión en NORA',
      },
      {
        executor: 'usuario',
        label: 'Revisión humana en NORA',
        phases: ['observacion'],
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Instrucción directa',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /carrusel indicando marca y tema. No requiere ComfyUI ni GPU — todo corre en Mac local.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario indica marca, tema/ángulo del carrusel y tipo de secuencia.',
            details: [
              'marca — Nombre exacto en Supabase (obligatorio)',
              'tema — Ángulo o propósito del carrusel (ej: tips, servicios, comparación)',
              'secuencia — Estándar (7 slides), listicle, tutorial, comparación',
              'imágenes — Rutas locales opcionales para fondos de slides',
            ],
          },
          {
            label: 'Cargar variables de entorno',
            resource: { type: 'env', name: '.env' },
            description: 'Se exportan las variables de Supabase para lectura de marca y upload de slides.',
            details: [
              'SUPABASE_URL',
              'SUPABASE_SERVICE_ROLE_KEY',
            ],
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca + imágenes aprobadas',
        executor: 'skill',
        executorDetail: 'carrusel',
        stateIn: null,
        stateOut: null,
        description: 'Lee la identidad de marca via carrusel-brand.js y busca imágenes aprobadas para usar como fondos de slides.',
        supabaseFields: {
          reads: {
            marcas: ['paleta_colores', 'tipografia', 'logos', 'arquetipo', 'look_and_feel', 'contenido_prohibido'],
            creatividades: ['link_ren_1', 'concepto', 'descripcion_corta', 'origen'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'script', name: 'carrusel-brand.js --marca {marca}' },
            description: 'Devuelve JSON con colores, tipografía, logos (color + claro), arquetipo, handle Instagram, look & feel.',
            details: [
              'nombre, handle — identidad pública',
              'colorPrimario, paleta — sistema de colores',
              'tipografia — font family de marca',
              'logoUrl — logo color (fondos claros)',
              'logoUrlClaro — logo blanco (fondos oscuros)',
              'arquetipo, lookAndFeel — personalidad visual',
              'contenidoProhibido — filtro negativo',
            ],
            filter: 'marca = {marca}',
          },
          {
            label: 'Buscar imágenes aprobadas para fondos',
            resource: { type: 'supabase', name: 'READ creatividades', op: 'READ' },
            description: 'Imágenes aprobadas de la marca que sirven como fondos de slides (espacio negativo, sin personas prominentes).',
            details: [
              'Filtro: condicion IN (resultado_final, aprobado)',
              'link_ren_1 NOT NULL, no .mp4',
              'Criterio: espacio negativo, producto/paisaje/conceptual',
              'Usar 2-4 imágenes distintas por carrusel',
            ],
            filter: 'marca = {marca} AND condicion IN (resultado_final, aprobado) AND link_ren_1 NOT NULL',
          },
        ],
      },

      procesamiento: {
        title: 'Colores + Tipografía + Contenido + HTML',
        executor: 'skill',
        executorDetail: 'carrusel',
        stateIn: null,
        stateOut: null,
        description: '4 sub-pasos: derivar sistema de colores (6 tokens), configurar tipografía, generar contenido de slides, componer HTML con layouts variados.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Derivar sistema de colores',
            resource: { type: 'skill', name: 'carrusel' },
            description: '6 tokens cromáticos derivados del color primario de marca.',
            details: [
              'BRAND_PRIMARY — acento principal',
              'BRAND_LIGHT — acento secundario (~20% más claro)',
              'BRAND_DARK — texto CTA (~30% más oscuro)',
              'LIGHT_BG — off-white con tinte complementario',
              'LIGHT_BORDER — ligeramente más oscuro que LIGHT_BG',
              'DARK_BG — casi negro con tinte de marca',
            ],
          },
          {
            label: 'Configurar tipografía',
            resource: { type: 'skill', name: 'carrusel' },
            description: 'Par heading + body de la marca o Google Fonts. Escala variable obligatoria.',
            details: [
              'H1 portada: 28-44px, H2 interiores: 22-36px',
              'Big statement: 36-48px, Tags: 9-12px uppercase',
              'Variedad obligatoria: al menos 2 tamaños distintos de heading',
            ],
          },
          {
            label: 'Generar contenido de slides',
            resource: { type: 'skill', name: 'carrusel' },
            description: 'Gancho para slide 1, secuencia de contenido, copy por slide, CTA final, y caption para redes. Puede buscar en la web para enriquecer con datos reales.',
            details: [
              'WebSearch / WebFetch — busca datos, estadísticas o tendencias relevantes al tema',
              'Slide 1: gancho — afirmación polémica, número+beneficio, pregunta que duele',
              'Slides 2-6: contenido alternando claro/oscuro',
              'Slide final: CTA con logo, tagline, botón con ícono SVG',
              'Secuencias: estándar (7), listicle (5-10), tutorial (7), comparación (5)',
              'Caption: texto que acompaña el post en redes (hashtags, CTA, contexto)',
            ],
          },
          {
            label: 'Componer HTML swipeable',
            resource: { type: 'skill', name: 'carrusel' },
            description: 'HTML limpio con slides navegables via flechas. Sin emular interfaz de Instagram.',
            details: [
              '7 layouts: centrado, bottom-anchored, top-left editorial, split, big number, card flotante, offset lateral',
              '5 tipos de fondo: LIGHT, DARK, GRADIENT, IMAGE_DARK, IMAGE_GRADIENT',
              'Barra de progreso + flecha swipe en cada slide',
              'Navegación: flechas izquierda/derecha entre slides',
              'Imágenes embebidas como data: URI base64 (nunca rutas)',
            ],
          },
        ],
      },

      ejecucion: {
        title: 'Playwright export → PNG 1080×1350',
        executor: 'skill',
        executorDetail: 'Playwright (chromium)',
        stateIn: null,
        stateOut: null,
        description: 'Exporta cada slide como PNG individual de 1080×1350px usando Playwright chromium headless.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Exportar slides via Playwright',
            resource: { type: 'skill', name: 'carrusel → Playwright export' },
            description: 'Viewport 420×525, device_scale_factor 2.5714 para output 1080×1350. Navegación queda fuera del canvas.',
            details: [
              'Viewport: 420×525px (solo el canvas, sin flechas ni counter)',
              'device_scale_factor: 2.5714 (1080/420) para alta resolución',
              'wait_for_timeout(3000): espera carga de Google Fonts',
              'Cada slide: translateX para posicionar, screenshot con clip sobre .carousel-wrapper',
              'Output: ~/Desktop/noracode/carruseles/{marca}/{fecha}/slides/slide_N.png',
            ],
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'Mac local — sin GPU, Playwright chromium headless' },
          { icon: '⏱️', label: 'Tiempo', value: '~10-20 segundos (7 slides)' },
          { icon: '📐', label: 'Output', value: 'PNG 1080×1350px por slide (ratio 4:5)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + crear carrusel en NORA',
        executor: 'script',
        executorDetail: 'carrusel-upload.js',
        stateIn: null,
        stateOut: 'listo',
        description: 'Sube PNGs exportados a Supabase Storage y crea registros en tablas carruseles + carrusel_slides.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['carrusel-{id}-slide-{n}-{ts}.png → bucket creatividades (PNG por slide)'],
            carruseles: {
              insert: [
                'marca', 'titulo', 'copy (caption redes)',
                'tamano → 4:5', 'template_id → html-skill',
                'estado → listo', 'html_path → ruta al index.html fuente',
              ],
            },
            carrusel_slides: {
              insert: [
                'carrusel_id', 'orden (1..N)',
                'imagen_base_url → URL Storage', 'imagen_final_url → URL Storage',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Subir PNGs a Storage',
            resource: { type: 'script', name: 'carrusel-upload.js --dir {slides_dir} --marca {marca} --titulo {titulo} --copy {copy}' },
            description: 'Lee PNGs del directorio ordenados por número, sube cada uno al bucket creatividades.',
          },
          {
            label: 'Crear registro carrusel',
            resource: { type: 'supabase', name: 'INSERT carruseles', op: 'INSERT' },
            description: 'Registro principal con metadata del carrusel.',
            details: [
              'marca — nombre de la marca',
              'titulo — título del carrusel',
              'copy — caption para redes sociales',
              'tamano → 4:5 (1080×1350)',
              'template_id → html-skill',
              'estado → listo',
            ],
            stateChange: 'NULL → listo',
          },
          {
            label: 'Crear slides individuales',
            resource: { type: 'supabase', name: 'INSERT carrusel_slides', op: 'INSERT' },
            description: 'Un registro por slide con orden y URLs de imagen.',
            details: [
              'carrusel_id — FK al carrusel',
              'orden — posición (1, 2, 3...)',
              'imagen_base_url — URL pública en Storage',
              'imagen_final_url — URL pública en Storage',
            ],
          },
        ],
      },

      observacion: {
        title: 'Revisión humana en NORA Dashboard',
        executor: 'usuario',
        stateIn: 'listo',
        stateOut: 'listo',
        description: 'El usuario revisa el carrusel en NORA (CarruselEditor). Puede reordenar slides, editar textos, eliminar slides, cambiar template y tamaño.',
        supabaseFields: {
          reads: {
            carruseles: ['id', 'marca', 'titulo', 'copy', 'tamano', 'template_id', 'estado'],
            carrusel_slides: ['id', 'carrusel_id', 'orden', 'imagen_base_url', 'imagen_final_url', 'texto_principal', 'texto_secundario'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Revisar en CarruselEditor',
            resource: { type: 'usuario', name: 'NORA Dashboard — CarruselEditor' },
            description: 'Interfaz completa: panel de slides, preview grande, sidebar de configuración.',
            details: [
              'Reordenar slides (drag o flechas up/down)',
              'Editar texto principal y secundario por slide',
              'Cambiar template (6 opciones) y tamaño (1:1 o 4:5)',
              'Agregar slides desde creatividades aprobadas',
              'Eliminar slides individuales',
              'Máximo 10 slides (límite Instagram)',
            ],
          },
        ],
      },

    },
  },

  {
    id: 'mailing',
    title: 'Mailing',
    subtitle: 'Email HTML profesional → Supabase → Preview/Download en NORA',
    command: '/nora-mailing',
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
        label: 'Skill: nora-mailing',
        phases: ['lectura', 'procesamiento', 'ejecucion'],
        handoff: 'HTML email en /tmp',
      },
      {
        executor: 'script',
        label: 'Script: mailing-upload.js',
        phases: ['entrega'],
        handoff: 'mailing borrador en NORA',
      },
      {
        executor: 'usuario',
        label: 'Revisión + Copiar/Descargar HTML',
        phases: ['observacion'],
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Instrucción directa',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /nora-mailing indicando marca y tema. No requiere ComfyUI ni GPU — todo corre en Mac local.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario indica marca, tema/ángulo del mailing y tipo de email.',
            details: [
              'marca — Nombre exacto en Supabase (obligatorio)',
              'tema — Ángulo o propósito del email (ej: newsletter mensual, promo Black Friday)',
              'template — newsletter, promocional, o anuncio (auto-seleccionado si no se indica)',
            ],
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca',
        executor: 'skill',
        executorDetail: 'nora-mailing',
        stateIn: null,
        stateOut: null,
        description: 'Lee la identidad de marca via carrusel-brand.js (reutilizado).',
        supabaseFields: {
          reads: {
            marcas: ['paleta_colores', 'tipografia', 'logos', 'arquetipo', 'look_and_feel', 'contenido_prohibido'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'script', name: 'carrusel-brand.js --marca {marca}' },
            description: 'Devuelve JSON con colores, tipografía, logos, arquetipo, tono.',
            details: [
              'colorPrimario, paleta — sistema de colores',
              'tipografia — font family de marca',
              'logoUrl — logo color (header del email)',
              'arquetipo, lookAndFeel — personalidad y tono',
              'contenidoProhibido — filtro negativo',
            ],
            filter: 'marca = {marca}',
          },
        ],
      },

      procesamiento: {
        title: 'Contenido + HTML email-compatible',
        executor: 'skill',
        executorDetail: 'nora-mailing',
        stateIn: null,
        stateOut: null,
        description: 'Genera subject, preheader, secciones de contenido y compone HTML con inline CSS y table layout (600px max-width).',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Derivar design tokens',
            resource: { type: 'skill', name: 'nora-mailing' },
            description: '6 tokens cromáticos derivados del color primario (mismo sistema que carrusel).',
            details: [
              'BRAND_PRIMARY — CTA button, links',
              'BRAND_LIGHT — fondos de sección alternados',
              'BRAND_DARK — header background',
              'LIGHT_BG — fondo principal del email',
              'LIGHT_BORDER — separadores',
              'DARK_BG — footer background',
            ],
          },
          {
            label: 'Generar contenido del email',
            resource: { type: 'skill', name: 'nora-mailing' },
            description: 'Subject (50-60 chars), preheader (80-100 chars), secciones según template elegido.',
            details: [
              'Newsletter: hero + 2-3 bloques + CTA',
              'Promocional: hero grande + oferta + CTA urgente',
              'Anuncio: hero + mensaje + detalles + CTA suave',
            ],
          },
          {
            label: 'Componer HTML email-compatible',
            resource: { type: 'skill', name: 'nora-mailing' },
            description: 'HTML con table layout, inline CSS, responsive media queries, placeholders merge tags.',
            details: [
              'DOCTYPE XHTML Transitional (Outlook)',
              'Table layout, max-width 600px',
              'CSS inline en cada elemento',
              'Google Fonts @import con fallback Arial/Helvetica',
              'Preheader oculto (display:none)',
              'MSO conditionals para Outlook',
              'CTA bulletproof button (VML fallback)',
              'Placeholders: {{unsubscribe_url}}, {{company_address}}, {{browser_url}}',
            ],
          },
        ],
      },

      ejecucion: {
        title: 'HTML composition (Claude)',
        executor: 'skill',
        executorDetail: 'nora-mailing',
        stateIn: null,
        stateOut: null,
        description: 'Motor de ejecución es Claude — genera HTML completo email-compatible con brand identity. Sin GPU, sin servicios externos.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Generar HTML + texto plano',
            resource: { type: 'skill', name: 'nora-mailing → HTML generation' },
            description: 'Guarda HTML en /tmp/mailing_{marca}_{ts}.html y texto plano en /tmp/mailing_{marca}_{ts}.txt.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'Mac local — sin GPU, Claude genera HTML' },
          { icon: '⏱️', label: 'Tiempo', value: '~10-30 segundos' },
          { icon: '📐', label: 'Output', value: 'HTML email-compatible (600px, inline CSS, table layout)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + crear mailing en NORA',
        executor: 'script',
        executorDetail: 'mailing-upload.js',
        stateIn: null,
        stateOut: 'borrador',
        description: 'Inserta en tabla mailings, sube HTML a Storage, actualiza html_url.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: ['mailings/{marca}/{id}_{ts}.html → bucket creatividades'],
            mailings: {
              insert: [
                'marca', 'titulo', 'subject', 'preheader',
                'contenido_html', 'contenido_texto',
                'estado → borrador', 'tema', 'gatillador',
              ],
              update: [
                'html_url → URL pública en Storage',
              ],
            },
          },
        },
        steps: [
          {
            label: 'INSERT mailing + upload HTML',
            resource: { type: 'script', name: 'mailing-upload.js --html {path} --marca {marca} --subject {subject}' },
            description: 'Inserta registro, sube HTML a Storage, actualiza URL.',
          },
        ],
      },

      observacion: {
        title: 'Revisión + Copiar/Descargar en NORA Dashboard',
        executor: 'usuario',
        stateIn: 'borrador',
        stateOut: 'listo',
        description: 'El usuario revisa el mailing en NORA (MailingView). Preview desktop/mobile, copiar HTML, descargar, pedir cambios.',
        supabaseFields: {
          reads: {
            mailings: ['id', 'marca', 'subject', 'preheader', 'contenido_html', 'estado', 'notas_cambios'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Revisar en MailingView',
            resource: { type: 'usuario', name: 'NORA Dashboard — MailingView' },
            description: 'Preview iframe con toggle desktop (600px) / mobile (320px).',
            details: [
              'Preview desktop: max-width 600px',
              'Preview mobile: max-width 320px',
              'Copiar HTML al clipboard (para pegar en Mailchimp/Resend)',
              'Descargar HTML como archivo',
              'Aprobar: borrador → listo',
              'Pedir cambios: listo → borrador + notas_cambios',
              'Marcar enviado: listo → enviado',
            ],
          },
        ],
      },

    },
  },

  // ─── AFICHES (HTML → PNG → creatividades con origen=afiches) ───────
  {
    id: 'afiche',
    title: 'Afiches',
    subtitle: 'HTML 1080×1350 → Playwright PNG → creatividades (origen=afiches) con html_url para re-render',
    command: '/nora-afiche',
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
        label: 'Skill: nora-afiche',
        phases: ['lectura', 'procesamiento', 'ejecucion'],
        handoff: 'HTML + PNG en /tmp',
      },
      {
        executor: 'script',
        label: 'Script: afiche-upload.js',
        phases: ['entrega'],
        handoff: 'creatividad origen=afiches lista para revisión',
      },
      {
        executor: 'usuario',
        label: 'Revisión en NORA AfichesView',
        phases: ['observacion'],
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Instrucción directa',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /nora-afiche indicando marca y tema, o pasa --mailing-id N para adaptar un mailing existente al lienzo vertical.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'El usuario indica marca, tema o mailing-id.',
            details: [
              'marca — Nombre exacto en Supabase (obligatorio si no hay --id)',
              'tema — Ángulo del afiche (newsletter, promocional, anuncio)',
              '--mailing-id N — Opcional: heredar copy de un mailing existente',
              '--id N — Opcional: re-render sobre afiche existente para correcciones',
              'imágenes — Ruta local opcional para hero',
            ],
          },
          {
            label: 'Cargar variables de entorno',
            resource: { type: 'env', name: '.env.local' },
            description: 'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.',
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca (+ mailing base opcional)',
        executor: 'skill',
        executorDetail: 'nora-afiche',
        stateIn: null,
        stateOut: null,
        description: 'Lee identidad de marca via carrusel-brand.js y, si viene --mailing-id, lee el contenido_html del mailing.',
        supabaseFields: {
          reads: {
            marcas: ['paleta_colores', 'tipografia', 'logos', 'arquetipo', 'look_and_feel', 'contenido_prohibido'],
            mailings: ['contenido_html', 'subject', 'tema', 'secciones'],
            creatividades: ['link_ren_1', 'link_ren_2', 'concepto', 'origen', 'html_url'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'script', name: 'carrusel-brand.js --marca {marca}' },
            description: 'Devuelve JSON con colores, tipografía, logos, arquetipo, tono, redesUrls.',
            filter: 'marca = {marca}',
          },
          {
            label: 'Leer mailing base (opcional)',
            resource: { type: 'supabase', name: 'READ mailings WHERE id = {mailing_id}', op: 'READ' },
            description: 'Si --mailing-id, heredar copy, jerarquía y paleta del mailing. No copiar literal: rediseñar vertical.',
            filter: 'id = {mailing_id}',
          },
          {
            label: 'Leer HTML previo (si re-render)',
            resource: { type: 'supabase', name: 'READ creatividades WHERE id = {id}', op: 'READ' },
            description: 'Si --id, leer html_url para descargar el HTML original y aplicar los cambios pedidos.',
            filter: 'id = {id} AND origen = afiches',
          },
        ],
      },

      procesamiento: {
        title: 'Design tokens + contenido + HTML 1080×1350',
        executor: 'skill',
        executorDetail: 'nora-afiche',
        stateIn: null,
        stateOut: null,
        description: 'Deriva 8 tokens cromáticos (mismo sistema que mailing), genera contenido para el template elegido, compone HTML con flexbox/grid en lienzo fijo sin scroll.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Derivar design tokens',
            resource: { type: 'skill', name: 'nora-afiche' },
            description: '8 tokens derivados del color primario.',
            details: [
              'BRAND_PRIMARY, BRAND_LIGHT, BRAND_DARK',
              'ACCENT_COLOR — color secundario vibrante',
              'PILL_BG — fondo suave para pildoras',
              'LIGHT_BG, LIGHT_BORDER, DARK_BG',
            ],
          },
          {
            label: 'Generar contenido',
            resource: { type: 'skill', name: 'nora-afiche' },
            description: 'Headline, subtítulo, 1-2 bloques, CTA. Tipografía escalada ~1.8× vs email para miniatura WhatsApp.',
            details: [
              'Hero headline: 52-68px',
              'Body: 20-26px',
              'Micro-labels uppercase: 14-16px (letter-spacing 3px)',
              'Bloques: hero + stats callout + checklist/mito/lista + CTA',
            ],
          },
          {
            label: 'Componer HTML con flexbox/grid',
            resource: { type: 'skill', name: 'nora-afiche' },
            description: 'CSS moderno (chromium, no Gmail). Sin table layout, sin MSO, sin media queries, sin CAN-SPAM. Fondos alternados (mínimo 3).',
            details: [
              'body: width 1080px, height 1350px, overflow hidden',
              'Iconos SVG inline como data URIs',
              'Google Fonts con @import y display=swap',
              'Cada párrafo con strong + span ACCENT_COLOR',
              'Footer mini: logo + handle + 2-3 redes (SVG)',
            ],
          },
        ],
      },

      ejecucion: {
        title: 'Playwright chromium → PNG 1080×1350',
        executor: 'skill',
        executorDetail: 'Playwright (chromium headless)',
        stateIn: null,
        stateOut: null,
        description: 'Renderiza el HTML local con Playwright, viewport 1080×1350 device_scale_factor 1.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Exportar PNG via Playwright',
            resource: { type: 'skill', name: 'nora-afiche → Playwright export' },
            description: 'Navega a file:// del HTML local, espera 3s por Google Fonts, hace screenshot.',
            details: [
              'Viewport: 1080×1350, device_scale_factor: 1',
              'wait_for_timeout(3000) para fuentes',
              'page.screenshot(path=..., full_page=False, type="png")',
              'Output: /tmp/afiche_{slug}_{ts}.png',
            ],
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'Mac local — sin GPU, Playwright chromium headless' },
          { icon: '⏱️', label: 'Tiempo', value: '~5-10 segundos (incluye espera fuentes)' },
          { icon: '📐', label: 'Output', value: 'PNG 1080×1350 (ratio 4:5) + HTML fuente preservado' },
        ],
      },

      entrega: {
        title: 'Upload Storage + crear/actualizar creatividad',
        executor: 'script',
        executorDetail: 'afiche-upload.js',
        stateIn: null,
        stateOut: 'para_revision',
        description: 'Sube PNG y HTML a Storage, y hace INSERT (nueva creatividad con origen=afiches) o UPDATE (re-render sobre --id existente). Preserva html_url para correcciones futuras.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'origen'],
          },
          writes: {
            storage: [
              'afiches/{slug}/{ts}.png → bucket creatividades',
              'afiches/{slug}/{ts}.html → bucket creatividades',
            ],
            creatividades: {
              insert: [
                'marca', 'origen → afiches', 'condicion → para_revision',
                'estado → para_revision', 'link_ren_1 → URL pública PNG',
                'html_url → URL pública HTML', 'concepto', 'slogan_headline', 'copy',
              ],
              update: [
                'link_ren_1 (nueva URL PNG con ts)',
                'html_url (nueva URL HTML con ts)',
                'condicion → para_revision',
                'observacion → null',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Subir PNG + HTML a Storage y persistir',
            resource: { type: 'script', name: 'afiche-upload.js --html {path} --png {path} --marca {marca} [--id N]' },
            description: 'Modo create: INSERT nueva creatividad. Modo re-render: UPDATE sobre id existente preservando el ID.',
            stateChange: 'NULL → para_revision (o UPDATE del mismo id)',
          },
        ],
      },

      observacion: {
        title: 'Revisión en NORA AfichesView',
        executor: 'usuario',
        stateIn: 'para_revision',
        stateOut: 'resultado_final',
        description: 'El usuario revisa el afiche en NORA Aplicaciones > Afiches. Preview PNG + toggle HTML fuente, descarga PNG/HTML, aprobar o pedir cambios.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'marca', 'origen', 'link_ren_1', 'html_url', 'condicion', 'observacion', 'slogan_headline', 'concepto', 'copy'],
          },
          writes: {
            creatividades: {
              update: ['condicion (resultado_final al aprobar)', 'observacion (texto al pedir cambios)'],
            },
          },
        },
        steps: [
          {
            label: 'Revisar en AfichesView',
            resource: { type: 'usuario', name: 'NORA Dashboard — Aplicaciones > Afiches' },
            description: 'Lista lateral + preview PNG/HTML + acciones.',
            details: [
              'Toggle preview PNG / HTML fuente (iframe escalado)',
              'Descargar PNG (link directo link_ren_1)',
              'Descargar HTML (link directo html_url)',
              'Abrir HTML en pestaña nueva',
              'Aprobar → condicion = resultado_final',
              'Pedir cambios → observacion poblada + condicion = observado',
              'Eliminar creatividad',
            ],
          },
          {
            label: 'Re-render sobre misma creatividad',
            resource: { type: 'skill', name: '/nora-afiche --id N --cambios "texto"' },
            description: 'Si el usuario pide cambios, la skill lee html_url, aplica cambios, renderiza nuevo PNG y hace UPDATE preservando el id.',
            details: [
              'Se preserva el ID para historial único',
              'Nueva URL con timestamp distinto en Storage',
              'condicion → para_revision, observacion → null',
            ],
          },
        ],
      },
    },
  },
  {
    id: 'reporte-meta',
    title: 'Reporte Meta (Facebook + IG + Ads)',
    subtitle: 'Métricas en vivo via MCP meta-insights → análisis + hallazgos automáticos → HTML profesional → sync a NORA',
    command: '/reporte-meta',
    status: 'activo',

    executionBlocks: [
      {
        executor: 'usuario',
        label: 'Usuario',
        phases: ['activador'],
        handoff: 'invoca skill con cliente y rango de fechas',
      },
      {
        executor: 'skill',
        label: 'Skill: reporte-meta',
        phases: ['lectura', 'procesamiento', 'ejecucion'],
        handoff: 'HTML generado en carpeta de la marca',
      },
      {
        executor: 'script',
        label: 'Script: sync-reportes.js',
        phases: ['entrega'],
        handoff: 'reporte_meta_url actualizado en marcas',
      },
      {
        executor: 'usuario',
        label: 'Visualización en NORA Dashboard',
        phases: ['observacion'],
        handoff: null,
      },
    ],

    phases: {
      activador: {
        title: 'Solicitud de reporte',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /reporte-meta indicando cliente (slug) y rango de fechas. El skill detecta automáticamente las capacidades del cliente: Facebook (siempre), Instagram (si HAS_IG), Meta Ads (si HAS_ADS).',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'Slug del cliente + período (opcional, default 30 días).',
            details: [
              'cliente — Slug Meta (csj, rtk, equos, altascumbres, cemtra, meser, mirador, vichuquen, redagrupa)',
              '--desde / --hasta — Rango de fechas (YYYY-MM-DD)',
              'Ejemplo: /reporte-meta csj desde 2026-01-01 hasta 2026-03-31',
            ],
          },
          {
            label: 'Verificar token y capacidades',
            resource: { type: 'mcp', name: 'mcp__meta-insights__verify_token' },
            description: 'Detecta HAS_FB, HAS_IG, HAS_ADS y modo de operación.',
          },
        ],
      },

      lectura: {
        title: 'Extracción de datos via MCP meta-insights',
        executor: 'skill',
        executorDetail: 'reporte-meta',
        stateIn: null,
        stateOut: null,
        description: 'Lanza ~9-25 queries paralelas a Meta Graph API v21 (Page Insights, IG Insights, Ad Insights) según capacidades del cliente. Lee reporte previo si existe para rescatar contexto cualitativo.',
        supabaseFields: {
          reads: {
            marcas: ['nombre', 'reporte_meta_url'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Facebook orgánico (9 queries)',
            resource: { type: 'mcp', name: 'mcp__meta-insights__get_page_insights + get_page_posts' },
            description: 'KPIs día + days_28 (page_impressions_unique + page_impressions_paid_unique), reacciones, video org/paid, posts.',
          },
          {
            label: 'Instagram orgánico (8 queries, si HAS_IG)',
            resource: { type: 'mcp', name: 'mcp__meta-insights__get_ig_insights + get_ig_media' },
            description: 'Reach, views, follower trend, demografía, top media.',
          },
          {
            label: 'Meta Ads (9 queries, si HAS_ADS)',
            resource: { type: 'mcp', name: 'mcp__meta-insights__get_ad_account_insights' },
            description: 'KPIs cuenta, campañas, ad sets, creatives, breakdowns por plataforma/edad/dispositivo.',
          },
          {
            label: 'Lectura de reporte anterior (opcional)',
            resource: { type: 'doc', name: 'reporte-meta-{slug}.html previo' },
            description: 'Rescatar hallazgos cualitativos y context que no viene de los MCPs.',
          },
        ],
      },

      procesamiento: {
        title: 'Cálculo de métricas + hallazgos automáticos',
        executor: 'skill',
        executorDetail: 'reporte-meta',
        stateIn: null,
        stateOut: null,
        description: 'Calcula deltas, polaridad, separación org/paid (alcance_organico = page_impressions_unique − page_impressions_paid_unique, ambos days_28), engagement rate, composición video, frecuencia publicación. Aplica reglas de hallazgos vigentes (FB-04, FB-10 a FB-19, IG-*, ADS-*) y genera tabla de próximos pasos priorizados.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Métricas derivadas',
            resource: { type: 'skill', name: 'reporte-meta' },
            description: 'Deltas YoY o vs período anterior, polaridad (normal o invertida), engagement rate, days con pauta activa.',
          },
          {
            label: 'Separación org/paid (método directo)',
            resource: { type: 'skill', name: 'reporte-meta' },
            description: 'Alcance_paid = page_impressions_paid_unique (oficial Meta). Alcance_organico = total − paid. Sin heurísticas. Caveat: 5-15% de overlap documentado por Meta.',
          },
          {
            label: 'Generación de hallazgos',
            resource: { type: 'doc', name: 'meta-hallazgo-rules.md' },
            description: 'Máx 15 hallazgos ordenados bad → info → good. Cada hallazgo con tipo, texto datos concretos y recomendación.',
          },
        ],
      },

      ejecucion: {
        title: 'Renderizado HTML con template oficial NORA',
        executor: 'skill',
        executorDetail: 'reporte-meta + template-meta.html',
        stateIn: null,
        stateOut: null,
        description: 'Lee template HTML oficial (con logo NORA en base64) y reemplaza placeholders. Genera 4-6 tabs según modo: Facebook, Instagram, Meta Ads, Tendencias, Hallazgos, Próximos Pasos. Sparklines SVG inline con datos diarios.',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Leer template oficial',
            resource: { type: 'doc', name: '~/.claude/skills/reporte-meta/references/template-meta.html' },
            description: 'CRÍTICO: nunca escribir HTML desde cero — el template contiene el logo NORA en base64 y los estilos estandarizados.',
          },
          {
            label: 'Renderizar contenido por tab',
            resource: { type: 'skill', name: 'reporte-meta' },
            description: 'KPI grid 4×2, nota azul metodología, tabla comparativa (org/paid/totales), comp-bar composición, detalle video, reacciones, actividad contenido.',
          },
          {
            label: 'Escribir HTML en carpeta de la marca',
            resource: { type: 'doc', name: '/Users/imac/Desktop/noracode/{marca_folder}/reporte-meta-{slug}.html' },
            description: 'Nombre fijo, se sobreescribe cada vez. Ej: clinicasanjavier/reporte-meta-clinica-san-javier.html.',
          },
        ],
      },

      entrega: {
        title: 'Sincronización a Supabase Storage',
        executor: 'script',
        executorDetail: 'sync-reportes.js',
        stateIn: null,
        stateOut: null,
        description: 'Sube el HTML al bucket creatividades de Supabase y actualiza marcas.reporte_meta_url para que el cliente lo vea en el dashboard NORA.',
        supabaseFields: {
          reads: { marcas: ['id', 'marca', 'reporte_meta_url'] },
          writes: {
            storage: ['bucket creatividades: reportes-meta/{slug}/{ts}.html'],
            marcas: ['reporte_meta_url'],
          },
        },
        steps: [
          {
            label: 'Sync via script dedicado',
            resource: { type: 'script', name: 'cd /Users/imac/Desktop/noracode/nora && node scripts/sync-reportes.js' },
            description: 'Detecta automáticamente reportes nuevos vs marker .sync-reporte-meta-{slug}, sube y actualiza la URL en marcas.',
          },
        ],
      },

      observacion: {
        title: 'Visualización en NORA Dashboard',
        executor: 'usuario',
        executorDetail: 'NORA Dashboard',
        stateIn: null,
        stateOut: null,
        description: 'El cliente accede al reporte via NORA Dashboard. La URL queda persistente hasta el próximo sync.',
        supabaseFields: {
          reads: { marcas: ['reporte_meta_url'] },
          writes: {},
        },
        steps: [
          {
            label: 'Cliente accede al reporte',
            resource: { type: 'usuario', name: 'NORA Dashboard — sección Reportes' },
            description: 'HTML interactivo con tabs, sparklines, hallazgos y próximos pasos.',
          },
        ],
      },
    },
  },

  // ============================================================
  // Pipeline: Motion Graphics — Remotion (catalogo EffectsBibleVertical + PackCierre)
  // ============================================================
  {
    id: 'motion-graphics-remotion',
    title: 'Motion Graphics · Remotion',
    subtitle: 'Spot animado multi-marca: TSX monolítico copy-paste (catálogo EffectsBibleVertical como referencia, no librería runtime) + bed musical ambient + sting de cierre',
    command: '/nora-motion-graphics',
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
        label: 'Skill: nora-motion-graphics',
        phases: ['lectura', 'procesamiento'],
        handoff: 'INSERT creatividad origen=motion_graphics',
      },
      {
        executor: 'script',
        label: 'Script: motion-graphics.mjs',
        phases: ['ejecucion', 'entrega'],
        handoff: 'creatividad base_lista → para_revision',
      },
      {
        executor: 'usuario',
        label: 'Revisión humana',
        phases: ['observacion'],
        handoff: 'aprueba en NORA dashboard',
      },
    ],

    phases: {
      activador: {
        title: 'Instrucción directa',
        executor: 'usuario',
        stateIn: null,
        stateOut: null,
        description: 'El usuario invoca /nora-motion-graphics indicando marca, concepto y tipo (spot, recap, hook, anuncio).',
        supabaseFields: { reads: {}, writes: {} },
        steps: [
          {
            label: 'Instrucción del usuario',
            resource: { type: 'usuario', name: 'Terminal Claude Code' },
            description: 'Marca, concepto, tipo de pieza y mensaje principal.',
            details: [
              'marca — obligatorio (lookup en marcas)',
              'concepto — qué comunica el video',
              'tipo — spot, hook, recap, anuncio, etc.',
              'duración objetivo — 20-30s típico',
            ],
          },
        ],
      },

      lectura: {
        title: 'Identidad de marca + assets en PC-2',
        executor: 'skill',
        executorDetail: 'nora-motion-graphics',
        stateIn: null,
        stateOut: null,
        description: 'Lee identidad visual + logos + redes_urls + tipografia + arquetipo de la marca. Verifica que existan los assets de audio en PC-2 (sting de cierre, music bed). Si la marca no tiene bed, generar con scripts/musicgen-brand-bed.py.',
        supabaseFields: {
          reads: {
            marcas: ['identidad_visual', 'logos', 'redes_urls', 'tipografia', 'paleta_colores', 'arquetipo'],
          },
          writes: {},
        },
        steps: [
          {
            label: 'Leer identidad de marca',
            resource: { type: 'supabase', name: 'READ marcas', op: 'READ' },
            description: 'identidad_visual (HEX_LIST canónico), logos, redes_urls (URL para CTA), tipografia, arquetipo (tono).',
            filter: 'marca = {marca}',
          },
          {
            label: 'Verificar assets PC-2',
            resource: { type: 'doc', name: '${REMOTION_DIR}\\public\\music\\ + \\images\\logos\\' },
            description: 'Confirma que existan {slug}_cierre_sting.wav, {slug}_ambient_bed.wav y {slug}_logo_X.png. Si falta el bed, generar con musicgen-brand-bed.py antes del INSERT.',
          },
        ],
      },

      procesamiento: {
        title: 'Concepto + Libreto + TSX monolítico + INSERT',
        executor: 'skill',
        executorDetail: 'nora-motion-graphics',
        stateIn: null,
        stateOut: 'para_ejecucion',
        description: 'Define libreto, elige 6-8 secuencias del catálogo (copy-paste), genera TSX dual (9:16 + 4:5) self-contained con audio bed + sting integrados, inserta creatividad con prompt JSON.',
        supabaseFields: {
          reads: {},
          writes: {
            creatividades: {
              insert: [
                'marca', 'estado → para_ejecucion', 'origen → motion_graphics', 'condicion → null',
                'prompt → JSON {tsx_916, tsx_45, totalFrames, fps, compName}',
                'concepto', 'slogan_headline', 'copy',
              ],
            },
          },
        },
        steps: [
          {
            label: 'Concepto y libreto',
            resource: { type: 'skill', name: 'nora-motion-graphics' },
            description: 'Hook + 4-6 mensajes intermedios + CTA. 20-30s. Sin inventar stats.',
          },
          {
            label: 'Selección y copy-paste de secuencias',
            resource: { type: 'doc', name: 'remotion-nora-shared/EffectsBibleVertical.tsx' },
            description: 'Mín 6 secuencias del catálogo (sin repetir categoría >2 veces). Las secuencias S01-S36 NO se importan: se COPIA su código inline al TSX y se reemplazan textos/colores/imágenes por los de la marca. Manten timings, springs y layouts del catálogo.',
            details: [
              'Texto solo: WordReveal, ImpactZoom, GradientWord, IntroducingStack, etc.',
              'Texto+imagen: SplitText, FramedImageTypewriter, VideoOnPhone',
              'Texto+ícono: WaitParticles, ViewCounter, ClockIcon, BatteryTurbocharge',
              'Mockups: VideoMockup, Clapperboard, LogoSplash, MacNotification',
              'Cierre: PackCierre 150f con sting de marca (puede ser inline o import)',
            ],
          },
          {
            label: 'Generar TSX dual monolítico',
            resource: { type: 'skill', name: 'nora-motion-graphics' },
            description: 'Un .tsx self-contained para 1080×1920 + otro Feed para 1080×1350. NO importa S0X (son privadas). Único import compartido válido: PackCierre desde ./shared/PackCierre. GlitchWrapper, VenetianBlindTransition y GlitchTransition pueden ser inline o importados de ./shared/EffectsBibleVertical.',
          },
          {
            label: 'Integrar audio (bed + sting)',
            resource: { type: 'doc', name: 'public/music/{slug}_ambient_bed.wav + _cierre_sting.wav' },
            description: 'Audio bed root con envelope (fade-in/fade-out, volume 0.55) durante el cuerpo. Sting volume 1.0 dentro del PackCierre. Bed termina 1s antes del PackCierre para no superponer.',
            details: [
              'Bed: <Audio src={BED} volume={(f) => interpolate(f, [0, 20, frame_PC-75, frame_PC-30], [0, 0.55, 0.55, 0])}/>',
              'Sting: <Audio src={STING} volume={1.0} /> dentro de PackCierre',
              'Si la marca no tiene bed, generar con scripts/musicgen-brand-bed.py --slug {slug}',
            ],
          },
          {
            label: 'Insertar creatividad',
            resource: { type: 'supabase', name: 'INSERT creatividades', op: 'INSERT' },
            description: 'Creatividad con prompt JSON (tsx + metadata) y campos de copy.',
            details: [
              'estado: para_ejecucion',
              'origen: motion_graphics',
              'prompt: JSON {tsx_916, tsx_45, totalFrames, fps, compName}',
              'compName: solo letras+números (regex ^[a-zA-Z0-9]+$). NO _, NO -, NO espacios',
              'concepto, slogan_headline, copy',
            ],
            stateChange: 'NULL → para_ejecucion',
          },
        ],
      },

      ejecucion: {
        title: 'Render Remotion en PC-2',
        executor: 'script',
        executorDetail: 'motion-graphics.mjs',
        stateIn: 'para_ejecucion',
        stateOut: null,
        description: 'El script marca en_proceso, copia los .tsx a PC-2, registra composiciones en Root.tsx idempotente, ejecuta render dual (1080×1920 + 1080×1350) vía npx remotion render.',
        supabaseFields: {
          reads: {
            creatividades: ['id', 'prompt', 'marca', 'copy', 'slogan_headline', 'concepto'],
          },
          writes: {
            creatividades: {
              update_on_pickup: ['estado → en_proceso'],
              update_on_error: ['estado → error', 'observacion → [auto] mensaje de error'],
            },
          },
          filters: ['estado = para_ejecucion', 'origen = motion_graphics', 'prompt NOT NULL'],
        },
        steps: [
          {
            label: 'Pickup creatividad',
            resource: { type: 'script', name: 'motion-graphics.mjs → GET creatividades' },
            description: 'Filtros: estado=para_ejecucion, origen=motion_graphics, prompt NOT NULL. Cap --max=1.',
          },
          {
            label: 'Parse JSON y escribir TSX',
            resource: { type: 'script', name: 'motion-graphics.mjs → fs.writeFileSync' },
            description: 'Extrae tsx_916 y tsx_45 del prompt JSON, los escribe en tmp_motion_graphics/.',
          },
          {
            label: 'Copiar TSX a PC-2',
            resource: { type: 'script', name: 'motion-graphics.mjs → scp' },
            description: 'SCP {compName}.tsx + {compName}Feed.tsx a ${REMOTION_DIR}\\src\\.',
          },
          {
            label: 'Patch Root.tsx idempotente',
            resource: { type: 'script', name: 'motion-graphics.mjs → ssh + scp' },
            description: 'Lee Root.tsx, agrega imports y bloques <Composition> si no existen. SCP de vuelta.',
          },
          {
            label: 'Render 9:16 + 4:5',
            resource: { type: 'script', name: 'motion-graphics.mjs → ssh remotion render' },
            description: 'Dual render: 1080×1920 (compName) + 1080×1350 (compNameFeed). Timeout 15min cada uno.',
          },
        ],
        meta: [
          { icon: '⚙️', label: 'Hardware', value: 'PC-2: RTX 5080 (Remotion render)' },
          { icon: '⏱️', label: 'Tiempo', value: '~12s/video (dual 1080×1920 + 1080×1350, 605 frames @ 30fps validado RTK)' },
          { icon: '⚠️', label: 'Límite', value: 'Máx 1 video por corrida (--max=1 default)' },
          { icon: '📚', label: 'Biblioteca', value: 'remotion-nora-shared/ (PackCierre + theme + components compartidos; EffectsBibleVertical.tsx es referencia copy-paste, no librería runtime)' },
        ],
      },

      entrega: {
        title: 'Upload Storage + actualizar creatividad',
        executor: 'script',
        executorDetail: 'motion-graphics.mjs',
        stateIn: 'en_proceso',
        stateOut: 'base_lista',
        description: 'Descarga ambos MP4 desde PC-2, sube a Supabase Storage y actualiza la creatividad con ambos links.',
        supabaseFields: {
          reads: {},
          writes: {
            storage: [
              '{marca}_motion_graphics_{id}_916_{ts}.mp4 → bucket creatividades (1080×1920)',
              '{marca}_motion_graphics_{id}_45_{ts}.mp4 → bucket creatividades (1080×1350)',
            ],
            creatividades: {
              update: [
                'link_ren_2 → URL pública 9:16',
                'link_ren_1 → URL pública 4:5',
                'estado → base_lista',
                'condicion → para_revision',
              ],
            },
          },
        },
        steps: [
          {
            label: 'SCP-from PC-2',
            resource: { type: 'script', name: 'motion-graphics.mjs → scp' },
            description: 'SCP inverso: out/{compName}.mp4 + out/{compName}Feed.mp4 → Mac local. Requiere replace(/\\\\/g, \'/\') del remote path para que scp Mac acepte el path Windows.',
          },
          {
            label: 'Upload Storage',
            resource: { type: 'supabase', name: 'PUT storage (upsert)', op: 'UPSERT' },
            description: 'Sube ambos MP4 al bucket creatividades.',
          },
          {
            label: 'Actualizar creatividad',
            resource: { type: 'supabase', name: 'UPDATE creatividades', op: 'UPDATE' },
            description: 'Registra ambos links y cambia el estado.',
            stateChange: 'en_proceso → base_lista',
          },
        ],
      },

      observacion: {
        title: 'Revisión humana',
        executor: 'skill',
        stateIn: 'para_revision',
        stateOut: null,
        description: 'Jorge revisa los videos en NORA dashboard. Si observa algo, deja observación. La skill puede regenerar el TSX y crear una nueva creatividad.',
        manual: true,
        supabaseFields: { reads: { creatividades: ['link_ren_1', 'link_ren_2', 'observacion'] }, writes: {} },
        steps: [
          {
            label: 'Revisión en NORA',
            resource: { type: 'usuario', name: 'NORA Dashboard' },
            description: 'Visualiza ambos formatos. Aprueba o deja observación.',
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
