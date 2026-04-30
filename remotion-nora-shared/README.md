# remotion-nora-shared

Biblioteca compartida de Motion Graphics: catálogo de efectos (`EffectsBibleVertical.tsx`, 36 secuencias S01–S36), `PackCierre` genérico, componentes reutilizables (Glitch, Gradient, Particles, etc.) y tema base.

Es la fuente canónica versionada. PC2 (`C:\Users\conta\.openclaw\workspace\remotion-nora\`) tiene un working copy que se sincroniza desde aquí.

---

## Contenido

| Archivo | Qué es |
|---|---|
| `EffectsBibleVertical.tsx` | Catálogo maestro: GlitchWrapper, VenetianBlindTransition, S01–S36 (~1900 líneas) |
| `PackCierre.tsx` | Componente genérico de cierre 5s (logo + URL + sting de marca) |
| `theme.ts` | Paleta y fuentes base (DARK_BG, accent teal, purple, gradientes, Inter) |
| `components/GlitchText.tsx` | Texto con aberración cromática |
| `components/GradientText.tsx` | Texto con gradiente animado |
| `components/MovingBars.tsx` | Barras horizontales (marquee) |
| `components/Particles.tsx` | Sistema de partículas flotantes |
| `components/PulsingCircles.tsx` | Círculos pulsantes de fondo |
| `components/RippleEffect.tsx` | Ondas/ripple |
| `components/TypingCursor.tsx` | Cursor de typewriter parpadeante |

---

## Sincronización con PC2

Esta biblioteca vive en el repo (`nora-pipelines/remotion-nora-shared/`). PC2 la consume como `shared/` dentro de su proyecto Remotion (`C:\Users\conta\.openclaw\workspace\remotion-nora\src\shared\`).

**Procedimiento (cada vez que se actualiza la biblioteca):**

```bash
# Desde PC2 (Windows PowerShell, dentro de la carpeta donde se clona el repo)
cd <ruta-local-nora-pipelines>
git pull

# Sincronizar (reemplazar la carpeta shared/ con la última versión versionada)
robocopy remotion-nora-shared C:\Users\conta\.openclaw\workspace\remotion-nora\src\shared /MIR /XF README.md
```

**Patrón de import en composiciones nuevas:**

```tsx
// En C:\Users\conta\.openclaw\workspace\remotion-nora\src\MarcaConcepto.tsx
import { GlitchWrapper, S07_IntroducingStack } from "./shared/EffectsBibleVertical";
import { PackCierre } from "./shared/PackCierre";
import { theme } from "./shared/theme";
```

> **Regla**: las ediciones a estos archivos van **siempre por el repo** (PR + merge). PC2 es read-only respecto a `shared/`. Si toca arreglar un bug, se edita en `nora-pipelines/remotion-nora-shared/`, se commitea y PC2 sincroniza.

---

## Reglas del catálogo

- Mínimo 6 secuencias del catálogo por composición.
- No repetir categoría más de 2 veces.
- Al menos 1 secuencia con imagen y 2 con ícono.
- `GlitchWrapper` envuelve toda la composición (frames de glitch en `GLITCH_FRAMES`).
- Cierre obligatorio con `PackCierre` (5s, logo + URL + sting de marca).
- Renderizar en ambos formatos: 9:16 (1080×1920) y 4:5 (1080×1350).

---

## Pipeline asociado

`scripts/motion-graphics.mjs` (en este repo) consume esta biblioteca. La skill `nora-motion-graphics` (`.agents/skills/`) genera la creatividad en Supabase con `origen=motion_graphics`; el cron levanta la creatividad, genera el `.tsx` de la composición desde el catálogo, lo copia a PC2 y dispara el render dual.
