# StudyQuest

PWA de gamificación de estudio: tareas, hábitos, cursos, metas y proyectos dan
XP y monedas para subir de nivel. Proyecto personal, sin fines comerciales.

Stack: React 19, TypeScript estricto, Vite, zustand, react-router, Supabase
(Postgres + Auth), vite-plugin-pwa, Vitest. Se despliega en Render como sitio
estático. Los textos de la interfaz y la documentación van en español.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 (sin service worker) |
| `npm run typecheck` | Comprobación de tipos (`tsc --noEmit`) |
| `npm test` | Pruebas unitarias y de componentes (`vitest run`) |
| `npm run build` | Typecheck + build de producción; genera el service worker |
| `npm run preview` | Sirve el build; única forma de probar la PWA en local |
| `npm run icons` | Regenera los iconos PNG de la PWA |
| `npm run vapid` | Genera el par de claves VAPID para notificaciones push |
| `npm run worlds` | Ejecuta `scripts/gen-worlds.mjs` |

Requiere Node.js 22 (mínimo 20.19).

Antes de dar un cambio por terminado, ejecuta `npm run typecheck` y `npm test`.

## Arquitectura

```
src/
├─ core/      Dominio puro: tipos, niveles y XP, rachas, hábitos, logros,
│             catálogo de la tienda, misiones, datos de ejemplo
├─ data/
│  ├─ ports.ts    Contratos Repository y AuthPort
│  ├─ local/      Adaptador localStorage (y almacén en memoria para tests)
│  ├─ supabase/   Adaptador Supabase
│  └─ index.ts    Único lugar que decide qué adaptador se usa
├─ state/     data.ts (datos + reglas de juego) · ui.ts (toasts, modales, tema, sonido)
├─ features/  Una carpeta por pantalla, más layout y modales
├─ ui/        Componentes base y sprites pixel-art (sprites.ts)
├─ audio/     Efectos 8-bit con Web Audio
└─ pwa/       Hooks de conexión e instalación
supabase/migrations/   Esquema SQL con RLS
```

Las dependencias van en un solo sentido: `features/` y `ui/` → `state/` →
`core/` y `data/ports.ts`. Los adaptadores implementan los puertos.

- `core/` no importa React, zustand, Supabase ni nada de `data/`.
- `features/` y `ui/` no importan adaptadores ni el cliente de Supabase;
  hablan con el store.
- Solo `data/index.ts` lee `VITE_DATA_PROVIDER`.
- Una operación nueva de persistencia se declara en `data/ports.ts` y se
  implementa en todos los adaptadores, incluido el almacén en memoria.
- La lógica de negocio va en `core/` o `state/`, no dentro de componentes.

## Invariantes de datos

- Los ids los genera el cliente con `crypto.randomUUID`; `create` es
  idempotente por id.
- `habitLogs.upsert` es único por hábito y día.
- `wipe()` borra todo lo del usuario. Si agregas una tabla o colección,
  inclúyela.
- UI optimista con reversión: la acción actualiza el estado al instante, se
  guarda en segundo plano y, si falla, se revierte con aviso. Las escrituras
  pasan por la cola que conserva el orden; no la saltes.
- Las fechas de negocio son el día local `YYYY-MM-DD`, nunca UTC. No uses
  `toISOString().slice(0, 10)` para "hoy", rachas, hábitos ni `xp_events`.
- Tienda y logros viven en código (`core/catalog.ts`, `core/achievements.ts`),
  no en la base de datos.
- Agenda (`core/agenda.ts`): una fila por actividad o serie, nunca una por
  repetición; los cambios de una ocurrencia van en `exceptions`. Los bloques
  vinculados guardan solo el id del hábito o la tarea y nunca registran
  progreso ni dan XP por su cuenta. Las horas son de reloj local; la zona
  horaria solo entra al exportar el `.ics`.

## Reglas de juego

La tabla completa está en la sección "Reglas del juego" del README. Lo que no
debe romperse:

- El nivel L cuesta `250 × L` XP. 1 moneda por cada 4 XP. Subir de nivel da +500.
- El XP se otorga una sola vez y se devuelve al deshacer: una tarea lo da al
  pasar a "Superada" y lo quita al reabrirla; un hábito lo da al alcanzar el
  objetivo del día y lo quita si baja del objetivo.
- Sesión de estudio: 2 XP por minuto.
- Racha: días consecutivos con XP neto positivo. La de ayer sigue viva hasta
  que termine hoy. Un día congelado cuenta como activo sin dar XP.

Todo cambio en estas reglas lleva su prueba en Vitest y la actualización del README.

## Supabase

- Entidades con estructura anidada (`profiles`, `tasks`, `habits`, `courses`,
  `goals`, `projects`, `personal_rewards`) se guardan como documento en una
  columna `data jsonb`.
- Registros que se agregan por fecha (`habit_logs`, `study_sessions`,
  `xp_events`, `notifications`) son tablas relacionales.
- Toda tabla lleva `user_id` con valor por defecto `auth.uid()`, RLS activado
  y una política "solo el dueño".
- Los cambios de esquema van en un archivo nuevo y numerado dentro de
  `supabase/migrations/`, y deben poder ejecutarse más de una vez sin fallar.

## Variables de entorno y secretos

Todas las variables `VITE_*` se incrustan en el build y son públicas.

- `VITE_DATA_PROVIDER`: `local` (localStorage, sin backend ni login) o `supabase`.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: solo la clave `anon`.
- `VITE_VAPID_PUBLIC_KEY`: clave pública de push. La privada va únicamente en
  los secretos de la Edge Function.
- `VITE_GOOGLE_LOGIN`: muestra u oculta el acceso con Google.

Nunca pongas en el frontend ni en el repositorio la clave `service_role`, la
clave VAPID privada ni un archivo `.env`. Las claves de API que ingresa el
usuario (por ejemplo, la de Gemini) no se escriben en logs, notificaciones ni
variables de build.

## PWA y despliegue

- Las peticiones a `*.supabase.co` nunca se cachean en el service worker.
- `render.yaml` define lo necesario y no debe perderse: Rewrite
  `/* → /index.html`, `no-cache` para `sw.js`, `manifest.webmanifest` e
  `index.html`, y caché inmutable para `assets/*`.
- En Render es un Static Site, no un Web Service. Cada push a `main` despliega.
- Cambiar una variable `VITE_*` en Render exige un nuevo despliegue.

## Convenciones

- TypeScript estricto: sin `any`, `@ts-ignore` ni `as unknown as` salvo con la
  razón escrita al lado.
- Sin `catch` vacíos ni promesas sin esperar en escrituras.
- Pruebas: la lógica en `*.test.ts` (entorno Node); los componentes en `*.test.tsx`
  con `// @vitest-environment jsdom` en la primera línea y Testing Library.
- Los sprites son cuadrículas de texto en `ui/sprites.ts`, con todas las filas
  del mismo ancho; una prueba lo valida.
- No agregues imágenes ni audio de terceros: los sprites son dibujos propios y
  los sonidos se sintetizan con Web Audio.

## Límites conocidos (no son errores)

- La cola offline (`data/offline`) solo aplica con Supabase; usa *last write wins* entre dispositivos.
- Arrastrar y soltar tareas solo funciona con ratón o trackpad; en táctil y
  teclado se usan los botones.
- Los push (recordatorios de hábitos, hora límite de tareas y resumen semanal)
  necesitan Supabase. La lógica de cuándo avisar vive en
  `supabase/functions/_shared/` y la comparten la web y la Edge Function.
- El `.ics` exportado es una foto del momento: no se sincroniza solo.
