# Conexión Supabase — Configuración centralizada

## Variables de entorno

Las credenciales están en `/Users/imac/Desktop/noracode/nora-pipelines/.env`. Cargar **dentro del código Node** (evita `$()` que pide confirmación):

```javascript
import { readFileSync } from 'fs';
const env = readFileSync('/Users/imac/Desktop/noracode/nora-pipelines/.env', 'utf-8');
for (const l of env.split('\n')) { const t = l.trim(); if (t.length === 0 || t.startsWith('#')) continue; const e = t.indexOf('='); if (e > 0) process.env[t.slice(0, e)] = t.slice(e + 1); }
```

Variables disponibles: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COMFY_URL`.

## Endpoint
- **URL**: `process.env.SUPABASE_URL` (`https://fddokyfilokacsjdgiwe.supabase.co`)
- **REST base**: `${SUPABASE_URL}/rest/v1/`

## Headers obligatorios
```
Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
apikey: ${SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json
```

## Encoding — OBLIGATORIO Node.js

Para insertar o actualizar en Supabase, usar **Node.js** (no PowerShell) para garantizar UTF-8 correcto. PowerShell corrompe tildes y caracteres especiales del español.

**Método**: Escribir el JSON a archivo y enviarlo con Node.js vía `fetch()`.

## Charset
Todos los campos de texto en español deben ser **UTF-8**. Verificar tildes, ñ, signos ¿? ¡! antes de enviar.
