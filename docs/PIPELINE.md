# PIPELINE.md — Flujo completo de estados NORA

> Mapa de todos los pasos, transiciones y scripts del pipeline de creatividades.

## State Machine

```
null → para_procesamiento → para_ejecucion → en_proceso → ejecutado|base_lista (éxito) → para_revision
       (solo img2img)                                    → error (fallo, observacion=[auto] msg)
```

- **para_procesamiento**: creatividad creada desde NORA, esperando que el skill genere el prompt (solo img2img)
- **para_ejecucion**: prompt listo, esperando ComfyUI
- **en_proceso**: ComfyUI está procesando (evita duplicados)
- **ejecutado**: imagen/video generado (text2img/img2img)
- **base_lista**: video base generado (UGC, tiene upscale + postprod después)
- **error**: fallo en ComfyUI, observacion=[auto] mensaje

## Pipeline Text2Img (original, referencia, universal, requerido, calendario)

```
[Concepto] → [Skill generación] → [Prompt Master] → para_ejecucion
                                                        │
                                              comfy-text2img.mjs
                                              (node scripts/comfy-text2img.mjs --once --id=N)
                                                        │
                                                      ejecutado
                                                        │
                                            ┌───────────┴───────────┐
                                            │                       │
                                      [Iteración QA]         [Jorge revisa]
                                            │                       │
                                      ¿score ≥ 4.0?          ¿Aprobado?
                                            │                       │
                                     Sí → condicion=           condicion=
                                      para_revision →          aprobado /
                                      resultado_final          observado
```

### Detalle de pasos

| Paso | Estado | Qué ocurre | Quién actúa |
|---|---|---|---|
| 1-3 | — | Concepto + skill generación + prompt-master | NORA (skills de Claude Code) |
| 4 | `para_ejecucion` | Prompt listo en Supabase, esperando imagen | — |
| 5 | `ejecutado` | `comfy-text2img.mjs` genera imagen, sube URL | Script vía Bash tool |
| — | `para_revision` | Iteración evalúa la imagen | Skill iteración |
| — | `aprobado` | Jorge aprueba | Jorge |
| — | `resultado_final` | Versión publicada final | Jorge |

---

## Pipeline Img2Img (Producto, Colaborador, Interior, Exterior, Fachada)

```
[NORA INSERT] → para_procesamiento → [Skill img2img] → para_ejecucion
                 (condicion:requerido,     genera prompt,       │
                  prompt:NULL)             UPDATE estado    comfy-img2img.mjs
                                                                │
                                                            ejecutado
                                                                │
                                                    [Revisión / Iteración]
```

### Detalle de pasos

| Paso | Estado | Qué ocurre | Quién actúa |
|---|---|---|---|
| 1 | `para_procesamiento` | NORA crea creatividad sin prompt (Sorpréndeme NORA) | NORA frontend |
| 2-3 | `para_procesamiento` → `para_ejecucion` | Skill genera prompt, textos, estrategia. UPDATE estado | Skill img2img |
| 4 | `para_ejecucion` → `ejecutado` | `comfy-img2img.mjs` genera imagen editada | Script vía Bash tool |
| — | `para_revision` | Iteración evalúa la imagen | Skill iteración |

---

## Transiciones de `condicion`

```
null ──────────────> para_revision ──────> aprobado ──────> resultado_final
                         │                    │
                         │                    └──> observado
                         │                              │
                         │                         [se crea DUPLICADO
                         │                          con corrección,
                         │                          original queda "observado"]
                         │
                    [iteración evalúa]
                         │
                    score < 4.0 → se crea DUPLICADO con prompt mejorado
                    original → iteracion_resuelta
```

### Reglas de duplicación

- **NUNCA sobrescribir** una creatividad existente
- Iteración y observación SIEMPRE crean un registro nuevo (duplicado)
- El original queda con `observado` (preservado intacto para comparación)
- El duplicado arranca en `para_ejecucion` (text2img) o `para_ejecucion` (img2img, post-skill) para regenerar imagen

---

## Scripts del pipeline

| Script | Función | Input → Output | Dimensiones |
|---|---|---|---|
| `comfy-text2img.mjs` | Texto → imagen (Qwen 2.5) | `para_ejecucion` → `ejecutado` | 1104×1472 (3:4) |
| `comfy-img2img.mjs` | Edición de imagen (Qwen Image Edit) | `para_ejecucion` → `ejecutado` | nativa (3:4) |
| `comfy-t2v-ugc.mjs` | Texto → video (LTX 2.3) | `para_ejecucion` → `base_lista` | 576×1024 (9:16) |
| `upscale-ugc.mjs` | Upscale latent x2 | `base_lista` → `base_lista` | 1080×1920 |
| `postprod-ugc.mjs` | Post-producción Remotion | manual | 1080×1920 + 1080×1350 |

### Ejecución (desde Claude Code vía Bash tool)

```bash
# Text2img: procesar todo en para_ejecucion
node /Users/imac/Desktop/noracode/nora-pipelines/scripts/comfy-text2img.mjs --once

# Text2img: uno específico
node /Users/imac/Desktop/noracode/nora-pipelines/scripts/comfy-text2img.mjs --once --id=123
```

### Límite ComfyUI: máximo 4 imágenes por corrida
ComfyUI tiene VRAM leak que causa crash en la 5ta imagen. Ejecutar en tandas de 4 máximo, relanzar entre tandas para limpiar GPU.
