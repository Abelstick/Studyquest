# StudyQuest

App para estudiar como si fuera un videojuego: cada **tarea** es un bloque `?`, cada **hábito** un power-up, cada **curso** un mundo con tuberías, y todo da **XP** y **monedas** para subir de nivel (Goomba → Koopa → Toad → Pac-Man → … → Super Mario → Héroe del Tiempo).

React + TypeScript + Vite · PWA instalable · datos en Supabase (o en el navegador) · despliegue estático en Render.

## Empezar

```bash
npm install
cp .env.example .env      # rellena tus credenciales de Supabase (o usa VITE_DATA_PROVIDER=local)
npm run dev
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción (genera el service worker) |
| `npm run preview` | Sirve el build para probar la PWA |
| `npm test` | Pruebas (lógica de juego, adaptador local, store, sprites) |
| `npm run icons` | Regenera los iconos PNG de la PWA desde el sprite del bloque `?` |

**Modo local:** con `VITE_DATA_PROVIDER=local` (o sin variables) todo se guarda en `localStorage`, sin login ni backend. Útil para desarrollar. En el primer arranque la app ofrece cargar un **mundo de ejemplo** (3 cursos, tareas, hábitos, 100 días de historial) o empezar de cero.

## Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega y ejecuta [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Crea las tablas y activa **Row Level Security**: cada usuario solo ve sus filas.
3. **Project Settings → API**: copia la *Project URL* y la clave *anon public* a `.env`:
   ```
   VITE_DATA_PROVIDER=supabase
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. **Authentication → URL Configuration**: añade como *Site URL* / *Redirect URL* tu URL de Render (y `http://localhost:5173` para desarrollo). Sin esto, los enlaces de confirmación y el enlace mágico no vuelven a la app.
5. (Opcional) **Authentication → Providers → Email → Confirm email**: desactívalo si quieres entrar sin confirmar el correo mientras pruebas.

> La clave `anon` es pública por diseño; la seguridad la dan las políticas RLS del SQL. **Nunca** pongas la `service_role` en el frontend.

## Desplegar en Render

El repo incluye [`render.yaml`](render.yaml) (Blueprint de *Static Site*).

1. Sube el proyecto a GitHub/GitLab.
2. En Render: **New → Blueprint** y selecciona el repo. Te pedirá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Cada `git push` a la rama principal despliega solo.

Detalles ya configurados: reescritura `/* → /index.html` (rutas de React Router), `sw.js` / `manifest` / `index.html` sin caché (para que la PWA se actualice) y `assets/*` con caché inmutable.

⚠️ Las variables `VITE_*` se incrustan **en el build**: si las cambias en Render, lanza un nuevo despliegue.

## PWA

- Manifest, iconos (normal + *maskable*) y service worker con precaché de toda la app → **abre sin conexión**.
- Al haber versión nueva aparece un aviso «Actualizar».
- Botón **Instalar app** en Perfil (cuando el navegador lo permite) y accesos directos («Nueva tarea», «Hábitos de hoy»).
- Con Supabase se guarda una copia de tu última partida para abrir al instante y sin red. **Sin conexión es de solo lectura**: si guardas algo, se avisa y se revierte (no hay cola de escritura offline).
- Las llamadas a `*.supabase.co` nunca se cachean.

## Arquitectura (y cómo cambiar de base de datos)

```
src/
  core/      Dominio puro: tipos, niveles/XP, rachas, hábitos, logros, catálogo, datos de ejemplo. Sin React ni BD.
  data/
    ports.ts        ← contratos: Repository y AuthPort
    local/          ← adaptador localStorage
    supabase/       ← adaptador Supabase (todo lo específico de Supabase vive aquí)
    index.ts        ← ÚNICO sitio que decide qué adaptador se usa
  state/     Stores (zustand): datos + reglas de juego (data.ts) y UI/preferencias (ui.ts)
  features/  Pantallas y modales
  ui/        Componentes base, sprites pixel-art
  audio/     Efectos 8-bit sintetizados (sin archivos)
```

La app solo habla con `Repository`/`AuthPort`. Para migrar a otro backend (Firebase, PocketBase, tu propia API…):

1. Crea `src/data/<nombre>/index.ts` que devuelva un `DataLayer` (implementa `Repository` y `AuthPort`).
2. Añade una rama en `src/data/index.ts` y una variable `VITE_DATA_PROVIDER=<nombre>`.
3. Nada más cambia: el store, las pantallas y las reglas de juego no saben qué hay detrás. `src/data/local/local.test.ts` sirve de modelo para probar el nuevo adaptador.

Decisiones útiles:
- **Los ids los genera el cliente** (`crypto.randomUUID`), así crear es idempotente y la UI es optimista: se actualiza al instante y, si guardar falla, se revierte y se avisa.
- Las escrituras pasan por una **cola** que conserva el orden.
- Tareas, hábitos, cursos, metas y proyectos se guardan como **documentos `jsonb`** (su estructura anidada cambia a menudo); los registros de actividad (`habit_logs`, `study_sessions`, `xp_events`, `notifications`) son **tablas relacionales** porque se consultan por fecha.
- La tienda y los logros son **catálogo en código** (`core/catalog.ts`, `core/achievements.ts`): cambiarlos no requiere migración.
- Las fechas de negocio son **días locales** `YYYY-MM-DD` (no UTC), para que «hoy» sea hoy en tu zona horaria.

## Reglas del juego

- Nivel *L* cuesta `250·L` XP (nivel 12 → 3 000). Cada nivel tiene mundo (`3-4`) y rango.
- 1 moneda por cada 4 XP; subir de nivel da +500 monedas; cada logro da monedas.
- Tarea, hábito (al alcanzar el objetivo), tema de curso, hito y checkpoint dan su XP; **deshacerlos lo devuelve**. Sesión de estudio: 2 XP/min. Reto semanal: +200 XP.
- La racha cuenta días con XP neto positivo; «Congelar racha» (tienda) marca un día como activo.

## Estado y límites conocidos

- Frecuencias de hábito implementadas: diario, días concretos, cada X días, semanal y mensual. (El diseño también listaba *fechas*, *anual* y *personalizado*: no incluidas.)
- Ordenar/mover tareas se hace con botones (Empezar / Completar / Reabrir), no arrastrando.
- No verificado contra una instancia real de Supabase: el adaptador y el SQL están escritos según la API, pero conviene probar el registro/login y un guardado tras ejecutar la migración.
