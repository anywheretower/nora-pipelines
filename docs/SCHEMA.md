# SCHEMA.md — Tablas de Supabase NORA

> Fuente única de verdad para la estructura de datos. Si una skill necesita saber qué campos tiene una tabla, viene acá.

## Conexión

- **URL**: `https://fddokyfilokacsjdgiwe.supabase.co`
- **Auth**: Header `Authorization: Bearer <service_role_key>`
- **Encoding**: Usar Node.js para escrituras (preserva UTF-8 con tildes/ñ)
- **REST**: `{URL}/rest/v1/{tabla}?{query}`

---

## Tabla `marcas`

Identidad completa de cada marca. Cada skill de generación lee estos campos.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int | PK autoincremental |
| `created_at` | timestamp | Fecha de creación |
| `marca` | text | Nombre único de la marca (ej: "Equos", "CSJ") |
| `ficha` | text | Ficha de identidad (propósito, público, tono, etc.) |
| `arquetipo` | text | Arquetipo de marca aterrizado al rubro |
| `paleta_colores` | text | Descripción detallada de colores, degradados, fondos |
| `look_and_feel` | text | Dirección visual: registros fotográficos, iluminación, estilo |
| `tipografia` | text | Fuentes y uso tipográfico |
| `notas_generales` | text | Reglas de generación: sujetos, ángulos, escenarios, prohibiciones |
| `contenido_prohibido` | text | Elementos explícitamente prohibidos en creatividades |
| `version` | int | Versión del registro |
| `logos` | text | URLs de logos (principal, blanco, invertido) |
| `user_id` | uuid | FK al usuario dueño |
| `getlate_accounts` | jsonb | Cuentas de redes sociales vinculadas |
| `escenario` | text | Escenarios específicos para edición de imagen |
| `activa` | bool | Si la marca está activa para generación |
| `redes_urls` | text | URLs de redes sociales |

**Campos que leen TODAS las skills de generación:**
- `ficha`, `arquetipo` → contexto estratégico
- `paleta_colores`, `look_and_feel` → dirección visual
- `notas_generales` → reglas específicas (sujetos, ángulos, escenarios)
- `contenido_prohibido` → filtro negativo
- `logos` → para insertar en creatividades

---

## Tabla `creatividades`

Registro de cada pieza creativa. Tabla central del pipeline.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int | PK autoincremental |
| `created_at` | timestamp | Fecha de creación |
| `marca` | text | Nombre de marca (FK lógica a marcas.marca) |
| `estado` | text | Paso actual del pipeline (ver Pipeline) |
| `condicion` | text | Estado de revisión/aprobación |
| `origen` | text | Tipo de creatividad / skill que la generó |
| `prompt` | text | Prompt enviado a Qwen / ComfyUI |
| `url` | text | URL de imagen generada (Supabase Storage) |
| `gatillador` | text | Instrucción breve que originó la creatividad |
| `concepto` | text | Dirección creativa (de skill concepto) |
| `slogan_headline` | text | Headline principal |
| `subtitulo` | text | Línea secundaria |
| `cta` | text | Call to action |
| `copy` | text | Texto largo / cuerpo |
| `descripcion_corta` | text | Resumen breve para feeds |
| `buyer_persona` | text | Perfil del público objetivo |
| `dolor_anhelo` | text | Pain point o deseo que ataca |
| `cambio_emocional` | text | Transformación emocional buscada |
| `diferenciador` | text | Qué hace única esta pieza |
| `beneficios` | text | Beneficios comunicados |
| `objeciones_tipicas` | text | Objeciones que anticipa |
| `logo` | text | URL del logo usado |
| `link_ren_1` | text | URL video formato 4:5 (feed) |
| `link_ren_2` | text | URL video formato 16:9 (landscape) |
| `observacion` | text | Feedback de Jorge (null = sin observación) |
| `tags` | text | Tags separados por coma (ej: "iterado_r1, score:4.2") |

### Valores de `estado`

| Estado | Significado | Quién lo procesa |
|---|---|---|
| `para_ejecucion` | Prompt listo, esperando generación text2img | `comfy-text2img.mjs` |
| `ejecutado` | Imagen generada, esperando revisión | Revisión humana o iteración |
| `paso 6` | Prompt de edición listo, esperando img2img | Skill producto |
| `paso 8` | Imagen editada 3:4 generada | `comfy-img2img.mjs` (ratio 3:4) |
| `paso 10` | Imagen editada 16:9 generada | `comfy-img2img.mjs` (ratio 16:9) |
| null/vacío | Video o creatividad sin pipeline de imagen | — |

### Valores de `condicion`

| Condición | Significado |
|---|---|
| `para_revision` | Lista para QA automático (iteración) o revisión humana |
| `aprobado` | Aprobada por Jorge, no tocar |
| `resultado_final` | Versión definitiva publicada |
| `observado` | Jorge dejó observación (pendiente o ya resuelta — la original queda siempre como "observado") |
| `requerido` | Creada desde tabla requerimientos |

### Valores de `origen`

| Origen | Pipeline | Script |
|---|---|---|
| `original` | text2img | `comfy-text2img.mjs` |
| `referencia` | text2img | `comfy-text2img.mjs` |
| `universal` | text2img | `comfy-text2img.mjs` |
| `requerido` | text2img | `comfy-text2img.mjs` |
| `calendario` | text2img | `comfy-text2img.mjs` |
| `Producto` | img2img | `comfy-img2img.mjs` |
| `Colaborador` | img2img | `comfy-img2img.mjs` |
| `Interior` | img2img | `comfy-img2img.mjs` |
| `Exterior` | img2img | `comfy-img2img.mjs` |
| `Pantalla` | text2img 16:9 | `comfy-text2img.mjs --ratio=16:9` |
| `input` | img2img | `comfy-img2img.mjs` |
| `video` | Remotion | Pipeline de video |

> **Nota**: Los orígenes text2img van en minúscula. Los img2img van con Mayúscula inicial (legacy).

---

## Tabla `referencia`

Banco de imágenes de referencia para generación.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int | PK autoincremental |
| `created_at` | timestamp | Fecha de creación |
| `reference_id` | text | ID externo de la referencia |
| `url` | text | URL de la imagen en Storage |
| `summary` | text | Descripción de la imagen (qué se ve) |
| `prompt` | text | Prompt que podría recrear esta imagen |
| `etiquetas` | text | Tags por categoría (composición, técnica, sujeto, metáfora, elementos, emoción, paleta, rubro) |

---

## Tabla `inputs`

Datos de productos/colaboradores para textos de creatividades.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int | PK autoincremental |
| `created_at` | timestamp | Fecha de creación |
| `Marca` | text | Con M mayúscula (inconsistencia legacy) |
| `categoria` | text | Producto / Colaborador / Interior / Exterior / Fachada |
| `titulo` | text | Título del producto/servicio |
| `subtitulo` | text | Subtítulo |
| `cta` | text | Call to action específico |
| `descripccion` | text | Con doble C (typo legacy). Descripción del item |
| `link` | text | URL asociada |

---

## Tabla `requerimientos`

Pedidos específicos de clientes.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int | PK autoincremental |
| `created_at` | timestamp | Fecha de creación |
| `marca` | text | Nombre de marca |
| `requerimiento` | text | Texto libre del pedido del cliente |
| `estado` | text | Estado del requerimiento |
| `url` | text | Imagen adjunta por el cliente |
| `url_ref` | text | Imagen del banco interno (tabla referencia) |

> Ignorar requerimientos con texto "test".

---

## Tabla `calendario`

Fechas relevantes para generación proactiva de creatividades.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | int | PK autoincremental |
| `created_at` | timestamp | Fecha de creación |
| `marca` | text | Marca específica (null = todas las marcas) |
| `fecha` | text | MM-DD para recurrentes, YYYY-MM-DD para únicas |
| `nombre` | text | Nombre del evento |
| `tipo` | text | `feriado` / `efemeride` / `comercial` / `rubro` / `marca` |
| `rubro` | text | Rubro al que aplica (null = universal) |
| `notas` | text | Tips creativos, conexión con marca |
| `activa` | bool | Default true |

---

## Storage

Bucket: `creatividades` (público)
- Imágenes: `creatividades/{marca}/{id}_{variante}.png`
- Videos: `creatividades/{marca}/videos/{filename}.mp4`

Base URL: `https://fddokyfilokacsjdgiwe.supabase.co/storage/v1/object/public/creatividades/`
