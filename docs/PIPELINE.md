# PIPELINE.md — Flujo completo de estados NORA

> Mapa de todos los pasos, transiciones y scripts del pipeline de creatividades.

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
[Concepto] → [Skill producto] → paso 6
                                    │
                          NORA escribe prompt
                          de edición ≤600 chars
                                    │
                                  paso 7
                                    │
                          comfy-img2img.mjs
                           (SOLO ratio 3:4)
                                    │
                                  paso 8  ← imagen editada 3:4 lista
                                    │
                            [Revisión / Iteración]
```

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
- El duplicado arranca en `para_ejecucion` (text2img) o `paso 6` (img2img) para regenerar imagen

---

## Scripts del pipeline

| Script | Función | Input → Output | Dimensiones |
|---|---|---|---|
| `comfy-text2img.mjs` | Texto → imagen (Qwen 2.5) | `para_ejecucion` → `ejecutado` | 1104×1472 (3:4) |

### Ejecución (desde Claude Code vía Bash tool)

```bash
# Text2img: procesar todo en para_ejecucion
node /Users/imac/Desktop/noracode/nora-pipelines/scripts/comfy-text2img.mjs --once

# Text2img: uno específico
node /Users/imac/Desktop/noracode/nora-pipelines/scripts/comfy-text2img.mjs --once --id=123
```

### Límite ComfyUI: máximo 4 imágenes por corrida
ComfyUI tiene VRAM leak que causa crash en la 5ta imagen. Ejecutar en tandas de 4 máximo, relanzar entre tandas para limpiar GPU.
