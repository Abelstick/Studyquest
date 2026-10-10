<div align="center">

# 🍄 StudyQuest

**Estudia como si fuera un videojuego.**
Cada tarea es un bloque `?`, cada hábito un power-up y cada curso un mundo con tuberías.
Todo da XP y monedas para subir de nivel: *Goomba despistado → Koopa → Toad → Pac-Man → … → Super Mario → Héroe del Tiempo*.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-instalable-5a0fc8)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ecf8e?logo=supabase&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46e3b7?logo=render&logoColor=white)

[<img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="34">](https://render.com/deploy?repo=https://github.com/Abelstick/Studyquest)

<img src="docs/screenshots/inicio.png" alt="Pantalla de inicio de StudyQuest" width="900">

</div>

---

## Contenido

- [Qué incluye](#qué-incluye)
- [Capturas](#capturas)
- [Inicio rápido](#inicio-rápido)
- [Configurar Supabase](#configurar-supabase)
- [Desplegar en Render](#desplegar-en-render)
- [Usarla como app (PWA)](#usarla-como-app-pwa)
- [Trabajar sin conexión](#trabajar-sin-conexión)
- [Copias de seguridad](#copias-de-seguridad)
- [Recordatorios push](#recordatorios-con-repetición-y-sonido)
- [Planificador inteligente](#planificador-inteligente)
- [Tu ciudad](#tu-ciudad)
- [Tu héroe 3D](#tu-héroe-3d)
- [Repaso espaciado, calendario, jefes y Pomodoro](#repaso-espaciado-calendario-jefes-y-pomodoro)
- [Reglas del juego](#reglas-del-juego)
- [Arquitectura](#arquitectura)
- [Cambiar de base de datos](#cambiar-de-base-de-datos)
- [Modelo de datos](#modelo-de-datos)
- [Pruebas](#pruebas)
- [Problemas frecuentes](#problemas-frecuentes)
- [Límites conocidos](#límites-conocidos)
- [Créditos y marcas](#créditos-y-marcas)

## Qué incluye

### ¿Tarea, hábito, meta o proyecto?

| Es… | Elígelo si… | Ejemplo |
| --- | --- | --- |
| **Tarea** | lo haces **una vez** y se termina (quizá con fecha límite) | Entregar el informe del viernes |
| **Hábito** | lo **repites** con regularidad y quieres ver tu racha | Leer 20 minutos al día |
| **Meta** | es lo que quieres **lograr a largo plazo**, dividido en hitos | Aprender análisis de datos |
| **Proyecto** | vas a **construir y entregar** algo, hecho de partes | Mi portafolio web |

Se combinan: la *meta* es el destino, el *hábito* la constancia diaria, las *tareas* los pasos concretos y el *proyecto* lo que construyes por el camino. Si dudas, el botón **❓ ¿Cuál uso?** abre una guía con ejemplos y un mini test, y el **Planificador** lo arma todo a partir de un objetivo.

| Pantalla | Qué hace |
| --- | --- |
| **Inicio** | Misión del día (hábitos que tocan + tareas más urgentes), **con su desglose desplegable**: marca ahí mismo las subtareas de una tarea o los pasos de un hábito. Además nivel y XP, calendario de racha, informe semanal, consejos y repasos pendientes. |
| **Cursos** | Cada curso es un mundo: módulos (se desbloquean en orden), temas, rango `S/A/B+/B/C/D`, mentor y feedback. Marca temas como «necesito repasar». |
| **Tareas** | Tablero *Por jugar / En juego / Superada* con **arrastrar y soltar**, prioridad, fecha límite, subtareas, etiquetas, **repetición** (cada N días/semanas/meses) y **jefes finales con barra de vida**. |
| **Planificador** | Le dices «quiero aprender análisis de datos en 3 meses» y genera la ruta (Excel → SQL → Python → Pandas → Power BI → proyecto final) y **un plan con fechas** según tu disponibilidad, tus tareas y tus hábitos. Con **IA (Gemini, gratis)** o con plantillas. |
| **Certificaciones** | Vitrina de tus credenciales: título, quién la emite, fecha, **enlace al certificado** (se abre en una pestaña nueva), ID de credencial, caducidad con aviso y, si quieres, el curso con el que se relaciona. Cada una da XP y suma una pieza a tu museo. |
| **Apuntes** | Tu cuaderno: escribe lo que aprendes con un formato mínimo (`# título`, `- punto`, `**negrita**`, `` `código` ``). Cada apunte puede colgar de un curso y de un tema concreto, o ir suelto. Búsqueda sin tildes, etiquetas, fijar arriba y **exportar todo a Markdown** para llevártelo a Obsidian. Cada apunte suma un punto a tu biblioteca. |
| **Ciudad** | Seis edificios que **crecen con tu progreso real** (casa, biblioteca, academia, laboratorio, arena y museo), de 0 a 5 niveles, con recompensas en monedas al mejorar. También aparece resumida en Inicio. |
| **Calendario** | Vista mensual con tus tareas por fecha límite, las repeticiones futuras y los repasos de flashcards. Arrastra una tarea a otro día para reprogramarla. |
| **Repaso** | **Repaso espaciado**: los temas marcados «necesito repasar» vuelven a 1, 3, 7 y 14 días como **flashcards** que giran. |
| **Pomodoro** | Temporizador de enfoque/descanso con **música 8-bit** y un personaje que **corre mientras estudias**. Sigue vivo al cambiar de pantalla. |
| **Hábitos** | Frecuencia (diaria, días concretos, cada X días, semanal, mensual, **fechas concretas, anual y personalizada** «N veces por semana/mes»), recordatorio con **aviso repetido y sonido**, medición (minutos, páginas, veces, hecho/no hecho…), pasos de sesión, mapa de 12 semanas y aviso del día en que más fallas. Los días pasados de la tira semanal se pueden marcar, por si te olvidaste. |
| **Cadenas de hábitos** | Encadena una rutina en orden (dormir temprano → levantarse → ejercicio → estudio → proyecto). Cada eslabón es la **señal** del siguiente: la app te dice cuál toca ahora y a cuál va después, en Hábitos y en la misión de Inicio. **Nunca bloquea** —puedes registrar cualquier hábito cuando quieras— y completar la cadena entera en un día da **+100 XP**. |
| **Metas** | Árbol de hitos con habilidades y recompensa final. |
| **Proyectos** | Operación principal y *side quests* con checkpoints que dan XP. |
| **Progreso** | Horas por semana, distribución del tiempo por curso, mapa de actividad de 20 semanas. Filtro 90 días / 6 meses / todo. |
| **Héroe 3D** | Tu personaje en **3D con bloques**: eliges raza (**Saiyajin, Mario, Koopa, Protoss, Terran o Zerg**), **evoluciona** en 4 etapas a medida que subes de nivel estudiando y le compras **armas, poderes y skins** con tus monedas (puedes **probarlos antes de comprar**). Arrástralo para girarlo. |
| **Arsenal** | Tienda de Toad (11 avatares, marcos, **6 mundos visuales**, insignias, poderes), **51 logros** y recompensas personales de la vida real. |
| **Personajes** | **21 avatares** con arte pixel propio (búho, mago, ninja, astronauta, zorro, pingüino, rana, murciélago, ajolote, dragón…) y **cada uno con su gesto de reposo**: el fantasma flota, el slime se aplasta, el ninja parpadea de sitio, el dragón respira. Se ven moviéndose ya en la tienda, antes de comprarlos. |
| **Perfil** | Camino de aprendizaje, insignias, ajustes, instalar la app, **recordatorios**, **exportar/importar tu partida**, cerrar sesión y reiniciar partida. |

Además: sesiones de estudio con temporizador, búsqueda global, notificaciones, modo día/noche, efectos de sonido 8-bit (sintetizados, sin archivos), pantalla de *level up* con lluvia de monedas, y diseño responsive con barra inferior y botón `?` flotante en móvil.

## Capturas

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/tareas.png" alt="Tablero de tareas"><br><sub><b>Tareas</b> · tablero por estado</sub></td>
    <td width="50%"><img src="docs/screenshots/habitos.png" alt="Hábitos"><br><sub><b>Hábitos</b> · power-ups equipados</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/curso.png" alt="Detalle de curso"><br><sub><b>Curso</b> · mapa de módulos y temas</sub></td>
    <td><img src="docs/screenshots/progreso.png" alt="Progreso"><br><sub><b>Progreso</b> · horas, distribución y actividad</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/arsenal.png" alt="Arsenal"><br><sub><b>Arsenal</b> · tienda, logros y premios</sub></td>
    <td><img src="docs/screenshots/subida-de-nivel.png" alt="Subida de nivel"><br><sub><b>Level up</b> · ¡Mundo 4-1 desbloqueado!</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/modo-noche.png" alt="Modo noche"><br><sub><b>Modo noche</b></sub></td>
    <td align="center"><img src="docs/screenshots/movil-inicio.png" alt="Inicio en móvil" width="170"> <img src="docs/screenshots/movil-habitos.png" alt="Hábitos en móvil" width="170"><br><sub><b>Móvil</b> · barra inferior y botón <code>?</code></sub></td>
  </tr>
</table>

## Inicio rápido

**Requisitos:** Node.js 22 (mínimo 20.19) y npm.

```bash
git clone https://github.com/Abelstick/Studyquest.git
cd Studyquest
npm install
cp .env.example .env     # en PowerShell: Copy-Item .env.example .env
npm run dev              # http://localhost:5173
```

El `.env.example` viene con `VITE_DATA_PROVIDER=local`, así que la app funciona desde el primer momento **sin backend ni login**: guarda todo en el navegador. En el primer arranque te ofrece cargar un **mundo de ejemplo** (3 cursos, tareas, hábitos y 100 días de historial, nivel 12 con racha de 18 días) o empezar de cero. Para usar Supabase, sigue [la siguiente sección](#configurar-supabase).

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Typecheck estricto + build de producción (genera el service worker) |
| `npm run preview` | Sirve el build para probar la PWA de verdad |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run typecheck` | Solo comprobación de tipos |
| `npm run icons` | Regenera los iconos PNG de la PWA desde el sprite del bloque `?` |
| `npm run worlds` | Regenera el decorado de los mundos (`src/styles/worlds.css`). |
| `npm run vapid` | Genera un par de claves VAPID para los [recordatorios push](#recordatorios-con-repetición-y-sonido) |

## Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) y ejecútalo. Crea las tablas y activa **Row Level Security**: cada usuario solo puede ver y modificar sus propias filas. Ejecuta después [`0005_certifications.sql`](supabase/migrations/0005_certifications.sql) y [`0006_notes.sql`](supabase/migrations/0006_notes.sql), que añaden las tablas de certificaciones y apuntes. **Si ya tenías la base creada antes**, te basta con ejecutar esa última.
3. En **Project Settings → API** copia la *Project URL* y la clave *anon public* en tu `.env`:

   ```ini
   VITE_DATA_PROVIDER=supabase
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

4. En **Authentication → URL Configuration** añade tus URL permitidas: la de producción (`https://tu-app.onrender.com`) y `http://localhost:5173`. Sin esto, los enlaces de confirmación y el enlace mágico redirigen a un sitio equivocado.
5. *(Opcional)* En **Authentication → Providers → Email**, desactiva *Confirm email* mientras pruebas para poder entrar sin confirmar el correo.

### Iniciar sesión con Google

La pantalla de acceso ofrece **«Continuar con Google»** como opción principal (el correo y la contraseña quedan debajo, plegados). Para activarlo, una sola vez:

1. En [Google Cloud Console](https://console.cloud.google.com/) crea (o elige) un proyecto → **APIs y servicios → Pantalla de consentimiento de OAuth** (tipo *Externo*; basta con nombre de la app y tu correo).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**. En **URI de redireccionamiento autorizados** pon exactamente la URL de callback de Supabase: `https://<tu-ref>.supabase.co/auth/v1/callback` (la ves en Supabase → Authentication → Providers → Google).
3. Copia el **ID de cliente** y el **Secreto**. En Supabase → **Authentication → Providers → Google**, actívalo y pégalos.
4. En **Authentication → URL Configuration** deben estar tu URL de Render y `http://localhost:5173` (paso 4 de arriba): a ellas vuelve el usuario tras elegir su cuenta.

No hace falta ninguna variable nueva ni migración: la sesión de Google entra por el mismo camino que la de correo, y los datos siguen protegidos por RLS. Si aún no has configurado Google, el botón mostrará el error del proveedor; puedes ocultarlo con `VITE_GOOGLE_LOGIN=false`.

> 🔐 **Seguridad.** La clave `anon` es pública por diseño: lo que protege tus datos son las políticas RLS del SQL. **Nunca** uses la clave `service_role` en el frontend. El archivo `.env` está en `.gitignore`; no lo subas al repositorio.

## Desplegar en Render

La app es una **SPA estática**: Render solo sirve archivos y el backend es Supabase. El repo incluye [`render.yaml`](render.yaml) con todo lo necesario.

### Con Blueprint (recomendado)

1. Sube el proyecto a GitHub.
2. En Render: **New → Blueprint**, elige el repositorio (o pulsa el botón *Deploy to Render* de arriba).
3. Render pide `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Pégalos.
4. A partir de ahí, cada `git push` a la rama principal despliega solo.

### A mano (Static Site)

> ⚠️ Elige **Static Site**, no *Web Service*. Un Web Service intenta ejecutar `npm run start` tras el build (y te da `Missing script: "start"`); esta app son solo archivos estáticos.

| Campo | Valor |
| --- | --- |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Environment | `NODE_VERSION=22`, `VITE_DATA_PROVIDER=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Redirects/Rewrites | `/*` → `/index.html` (**Rewrite**, no Redirect) |

### Lo que ya está resuelto en `render.yaml`

- **Rutas de React Router:** la reescritura `/* → /index.html` evita el 404 al recargar `/tareas` o abrir un enlace directo.
- **Caché correcta para la PWA:** `sw.js`, `manifest.webmanifest` e `index.html` van con `no-cache` (si no, los usuarios se quedan con una versión vieja); `assets/*` van con caché inmutable de un año (llevan hash en el nombre).
- Cabeceras `X-Content-Type-Options` y `Referrer-Policy`.

> ⚠️ Las variables `VITE_*` se **incrustan en el build**. Si las cambias en Render, hay que lanzar un nuevo despliegue (*Manual Deploy → Clear build cache & deploy*).

## Usarla como app (PWA)

- **Android / Chrome / Edge:** abre la web y pulsa *Instalar app* (Perfil → Ajustes) o el icono de instalar de la barra de direcciones.
- **iPhone / iPad:** Safari → *Compartir* → *Añadir a pantalla de inicio*.
- **Sin conexión:** todo el código se precachea, así que la app abre sin red, y con Supabase **también puedes guardar cambios sin conexión** (ver [Trabajar sin conexión](#trabajar-sin-conexión)).
- **Actualizaciones:** cuando hay versión nueva aparece un aviso «Actualizar».
- **Accesos directos:** mantén pulsado el icono para *Nueva tarea* o *Hábitos de hoy*.
- Las peticiones a `*.supabase.co` **nunca** se cachean: los datos siempre son los reales.

Para probar la PWA en local usa `npm run build && npm run preview` (el service worker no está activo en `npm run dev`).

## Trabajar sin conexión

Marca hábitos, completa tareas o registra estudio **sin red** (metro, avión, wifi malo): todo se guarda en el dispositivo y se envía solo al volver la conexión.

- Al perder la red, el marcador superior muestra `OFFLINE`. Cada cambio guardado en el dispositivo suma al aviso `⏳ N pendientes` (púlsalo para reintentar ya).
- Al volver la red se envían **en orden** y aparece «Sincronizado».
- La cola vive en **IndexedDB**: sobrevive a cerrar la app, recargar o apagar el móvil.
- Es un decorador ([`src/data/offline`](src/data/offline)) que envuelve **cualquier** adaptador remoto; el local no lo necesita.

**Reglas y límites que conviene saber**

- Un rechazo del servidor que **no** es de red (permisos, dato inválido) descarta ese cambio y te avisa, para no bloquear la cola para siempre.
- Con cambios pendientes la app no recarga datos del servidor (pisaría lo que aún no se envió): usa tu copia local hasta sincronizar.
- Conflictos: gana el último cambio enviado (*last write wins*). Si editas lo mismo desde dos dispositivos a la vez, uno pisa al otro.
- Los cambios de una cuenta solo se envían con esa cuenta iniciada.
- Hay que haber abierto la app **al menos una vez con conexión** (para cachearla y haber iniciado sesión). Pasada la hora de vida del token, la app sigue abriendo offline con tu último usuario; al volver la red renueva la sesión y sincroniza.

## Copias de seguridad

**Perfil → Cuenta y datos → Exportar copia (.json)** descarga toda tu partida: tareas, hábitos, cursos, historial, monedas, compras y logros. **Importar copia** la restaura (reemplaza lo que tengas: te pide confirmación y te muestra qué contiene).

- Sirve como **respaldo**, para **pasar de un dispositivo a otro** y para **migrar de base de datos** (exportas con un adaptador, importas con otro).
- El archivo lleva versión. Si es de una versión más nueva de la app, se rechaza con un mensaje claro.
- Al importar se **valida** todo: descarta elementos inválidos y los avisa, regenera ids que no sean UUID reescribiendo las referencias, y quita registros huérfanos (un registro de hábito sin hábito, una sesión de un curso inexistente).
- No está cifrado: contiene tus datos en claro. Guárdalo donde guardarías cualquier documento personal.

## Recordatorios (con repetición y sonido)

Cada hábito puede tener una hora de recordatorio (p. ej. 19:00) y un intervalo de repetición: **No repetir · cada 15 min · cada 30 min (por defecto) · cada hora**. A esa hora avisa **solo si ese día toca y aún no lo has hecho**, y **insiste cada N minutos hasta que lo marques como hecho** (máximo **6 avisos al día**; nunca cruza la medianoche). Al marcarlo hecho, deja de avisar.

Hay dos canales que funcionan a la vez y **no se duplican**:

| Canal | Cuándo | Cómo avisa | Necesita |
| --- | --- | --- | --- |
| **Dentro de la app** | Con la app abierta | Banner naranja que te lleva al hábito + el sonido «1-UP» (respeta el botón de sonido de la barra superior) | Nada: funciona también en modo local |
| **Push** | Con la app cerrada o en otra pestaña | Notificación del sistema | Supabase + activarlo en Perfil (ver abajo) |

- Con la pestaña **visible**, el aviso del servidor no muestra notificación del sistema: se lo pasa a la propia web, que suena y muestra el banner. Si el servidor y la web disparan el mismo aviso a la vez, solo se ve uno.
- Con la pestaña **oculta** y push activado, avisa el sistema. Sin push pero con permiso de notificaciones, la app muestra una notificación del sistema.
- El sonido en una pestaña oculta puede quedar bloqueado por el navegador si no has interactuado con la página desde que la abriste.

> ⚙️ Los **push** requieren **Supabase** (un servidor que envíe los avisos) y un dispositivo compatible: Chrome/Edge/Firefox en escritorio y Android, e **iPhone/iPad con iOS 16.4+ con la app instalada** en la pantalla de inicio (en Safari normal no funciona).

**Cómo funcionan los push:** un cron de Supabase llama cada minuto a la Edge Function [`send-reminders`](supabase/functions/send-reminders/index.ts). Esta le pide al planificador ([`_shared/reminders.ts`](supabase/functions/_shared/reminders.ts), **el mismo código que usa la web**, así nunca discrepan) qué avisos tocan ahora para cada usuario con dispositivos suscritos, según su hora local (la zona horaria de su dispositivo). Cada aviso se reserva en `reminder_log` de forma atómica (contador y hora del último), así que **nunca se envía dos veces** aunque la función se ejecute a la vez dos veces. El servidor usa además las mismas reglas de «¿toca hoy?» que la app: una prueba compara ambas con miles de casos.

**Puesta en marcha (una vez):**

1. **Claves VAPID:** `npm run vapid`. Copia la *pública* en `VITE_VAPID_PUBLIC_KEY` (tu `.env` y las variables de Render, y vuelve a desplegar). La *privada* solo va a Supabase, nunca al frontend ni a git. Si cambias las claves, todos los dispositivos deben volver a activar los recordatorios.
2. **Migraciones:** ejecuta en el SQL Editor, por orden, [`0002_push_reminders.sql`](supabase/migrations/0002_push_reminders.sql) y [`0003_reminder_repeats.sql`](supabase/migrations/0003_reminder_repeats.sql) (esta última añade el contador de avisos para poder repetirlos).
3. **Secretos y función** con la [CLI de Supabase](https://supabase.com/docs/guides/cli). No hace falta instalarla (se usa con `npx`), ni Docker, ni `supabase link`. Tu `<ref>` es la parte `xxxx` de `https://xxxx.supabase.co`.

   ```bash
   # 1) Iniciar sesión (abre el navegador; solo la primera vez)
   npx supabase login

   # 2) Crea un archivo `supabase.secrets.local` (ya está en .gitignore por acabar en .local) con:
   #      VAPID_PUBLIC_KEY=<la pública de npm run vapid>
   #      VAPID_PRIVATE_KEY=<la privada de npm run vapid>
   #      VAPID_SUBJECT=mailto:tu@correo.com
   #      CRON_SECRET=<cadena larga aleatoria, p. ej. node -e "console.log(require('crypto').randomBytes(24).toString('hex'))">
   npx supabase secrets set --env-file supabase.secrets.local --project-ref <ref>

   # 3) Desplegar la función
   npx supabase functions deploy send-reminders --no-verify-jwt --use-api --project-ref <ref>
   ```

   - `--no-verify-jwt`: la llama el cron, no un usuario; la protege `CRON_SECRET`.
   - `--use-api`: empaqueta en el servidor de Supabase, así no necesitas Docker.
   - `VAPID_SUBJECT` debe empezar por `mailto:` o `https://`, o la función falla al arrancar.
   - Comprueba que existe: Supabase → **Edge Functions** → debe aparecer `send-reminders`. Y `CRON_SECRET` debe ser el **mismo** valor que pongas en el paso 4.
4. **Cron:** en Database → Extensions activa `pg_cron` y `pg_net`; abre [`supabase/cron.sql.example`](supabase/cron.sql.example), rellena `<TU_CRON_SECRET>` y `<TU_PROJECT_REF>` y ejecútalo en el SQL Editor.
5. **En la app:** Perfil → Recordatorios → *Activar recordatorios* (acepta el permiso del navegador) y ponle hora a un hábito. El botón *Probar* muestra una notificación local para comprobar que el sistema las enseña.

**Probarlo sin esperar a la hora:**

```bash
curl -X POST https://<tu-project-ref>.supabase.co/functions/v1/send-reminders -H "x-cron-secret: <CRON_SECRET>"
# → {"ok":true,"users":1,"sent":1,"removed":0}
```

Pon la hora del recordatorio en los últimos 10 minutos (el primer aviso acepta esa ventana por si un minuto se retrasa). Para volver a probar el primer aviso el mismo día, borra la fila de `reminder_log` (`delete from reminder_log;`). Las **repeticiones** no salen hasta que pase el intervalo del hábito desde el último aviso. Si algo no llega, mira **Edge Functions → send-reminders → Logs** y `select * from cron.job_run_details order by start_time desc limit 10;`.

**Privacidad:** se guarda por dispositivo el *endpoint* de push, sus claves públicas y tu zona horaria (tabla `push_subscriptions`, con RLS). Al **cerrar sesión** el dispositivo se da de baja de los recordatorios de esa cuenta.

## Planificador inteligente

Pantalla **Planificador** (o el botón «Planificar con el asistente» en Metas). Tres pasos:

1. **Objetivo**: «Quiero aprender análisis de datos», el plazo (1, 2, 3, 6 meses o una fecha) y tu nivel.
2. **Tiempo**: cuánto puedes estudiar cada día de la semana (pasos de 15 min), con atajos («1 h al día», «solo fines de semana»…) y los días que no puedes (viajes, exámenes). La app **descuenta lo que ya tienes**: tareas con fecha y hábitos medidos en minutos u horas.
3. **Plan**: eliges de dónde sale la ruta (**tu propia ruta desde cero**, una **plantilla** o la **IA**) y la **editas por completo**: nombre de la meta, módulos (nombre, horas, orden, añadir/quitar), temas y los pasos del proyecto final. Verás una línea de tiempo con las fechas de cada tramo, y avisos como *«con tu disponibilidad caben 73 h de las 135 h que pide la ruta (54%). Necesitarías ~11 h por semana o ampliar el plazo a ~23 semanas»*. Si no cabe, recorta las horas de cada módulo por igual; si sobra tiempo, te avisa del margen.

Al pulsar **Crear mi plan** se crean, de una vez: un **curso** con módulos y temas, una **meta** con un hito por módulo (y sus habilidades), **una tarea por módulo y semana** con fecha (aparecen en el calendario), el proyecto final como **jefe** con sus pasos como golpes, y un **hábito** «Estudiar …» en tus días libres.

**De dónde sale el temario.** El *reparto en el tiempo* lo calcula siempre código propio (probado con tests, sin IA). El *temario* puede venir de:

| Origen | Cuándo | Coste |
| --- | --- | --- |
| **Tu propia ruta** | Empiezas en blanco y pones tú los módulos, temas y horas. No necesita IA ni plantilla. | Gratis |
| **Plantillas** | Editables después de elegirlas. Siempre disponibles, incluso sin conexión y en modo local: análisis de datos, desarrollo web, inglés, diseño UX/UI y marketing digital. Sugiere la que encaja con lo que escribiste. | Gratis |
| **IA (Gemini)** | Cualquier objetivo («preparar el examen de admisión», «aprender guitarra»…). Funciona en cualquier modo (local o Supabase). Cada persona usa **su propia clave**. | Gratis dentro de la cuota gratuita de Google AI Studio |

### Funciones inteligentes: cada usuario pone su propia clave

Las funciones con IA **están apagadas hasta que la persona las activa con su clave gratuita de Gemini**. La app se lo pide donde hace falta:

- en el **Planificador** (botón «🔑 Activar funciones inteligentes»),
- al editar las **tarjetas** de un tema («🔑 Activar IA para generar tarjetas»),
- y en **Perfil → Funciones inteligentes**, donde también se comprueba o se quita.

Cómo se activa (2 minutos, sin tarjeta):

1. Entra en [Google AI Studio → API keys](https://aistudio.google.com/apikey) con tu cuenta de Google.
2. Pulsa **Create API key** y copia la clave.
3. Pégala en la ventana de StudyQuest y pulsa **Probar y activar** (la comprueba con Google sin gastar cuota).

Con la IA activa aparece **«✨ Generar con IA»** en el Planificador y **«✨ Generar 5 con IA»** en el editor de tarjetas de cada tema.

**¿La misma clave en varios dispositivos?** Sí: una clave de Google no está atada a ningún dispositivo. Al activarla eliges dónde guardarla:

| Opción | Cómo funciona | Cuándo elegirla |
| --- | --- | --- |
| **Solo en este dispositivo** *(por defecto)* | `localStorage`. No sale del navegador salvo hacia Google. En otro dispositivo se pega de nuevo. | La más privada. Funciona también en modo local. |
| **En mi cuenta, cifrada con una frase** | Se cifra en el navegador (AES-GCM de 256 bits, clave derivada de tu frase con PBKDF2-SHA256 y 250 000 iteraciones) y en Supabase solo hay texto ilegible. En otro dispositivo escribes la frase y se descifra. | Recomendada si usas varios dispositivos. Si olvidas la frase, «Olvidé mi frase» borra la copia cifrada y pegas la clave otra vez. |
| **En mi cuenta, sin cifrar** | Se guarda tal cual en tu cuenta y se activa sola al iniciar sesión en cualquier dispositivo. | La más cómoda, pero quien administre la base de datos de la app podría leerla. |

Las dos opciones de cuenta solo aparecen con Supabase y necesitan ejecutar [`0004_user_secrets.sql`](supabase/migrations/0004_user_secrets.sql) una vez (crea la tabla `user_secrets`, con RLS: cada usuario solo ve la suya). Desde Perfil → Funciones inteligentes puedes **guardarla en la cuenta más tarde**, **quitarla de este dispositivo** o **borrarla de tu cuenta**.

**Dónde vive la clave y qué se envía**

- La clave **nunca** entra en las copias de seguridad ni en la caché del perfil: la cuenta la guarda en su propia tabla (`user_secrets`), aparte de tus datos de juego.
- Viaja únicamente en la cabecera `x-goog-api-key` de las peticiones a Google, nunca por un servidor de la app. Por eso no hay nada que configurar en Render ni en Edge Functions.
- **Cerrar sesión borra la clave de ese dispositivo** (la copia de tu cuenta se conserva), para no dejarla en un ordenador compartido.
- Como vive en el navegador, cualquier código malicioso en la página podría leerla: usa una clave **solo para esto**, restríngela en Google Cloud si puedes y bórrala en AI Studio si dejas de usarla.
- A Google solo se envía lo que pides: el objetivo, el plazo, el nivel y las horas por semana (planificador), o el título del tema y del curso (tarjetas). **Nunca** tus tareas, hábitos ni datos personales.
- En el nivel gratuito, Google puede usar esos textos para mejorar sus productos. Si eso te importa, usa una clave de un proyecto de pago (con facturación) o las plantillas.

La app usa el SDK oficial [`@google/genai`](https://www.npmjs.com/package/@google/genai) con `store: false` (Google no guarda la conversación) y sin reintentos automáticos. El SDK solo se descarga cuando se usa la IA, y todo lo que devuelve el modelo se valida antes de tocar tus datos.

### Modelos gratuitos y cambio automático

Por defecto se usa `gemini-3.8-flash`. También hay `gemini-3.7-flash`, `3.6-flash`, `3.5-flash`, `3.5-flash-lite`, `2.5-flash` y `2.5-flash-lite`: todos con nivel gratuito según la [documentación de Google](https://ai.google.dev/gemini-api/docs/pricing); los Pro no. Los límites se aplican por proyecto y por modelo (tus cifras: [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit)).

Con el **cambio automático** (activado por defecto), si el modelo agota su cuota (429), no existe para tu clave (404) o está saturado (503), la app prueba el siguiente modelo de reserva, te avisa y aparta el agotado 5 minutos. Otros errores no cambian de modelo. Se configura en Perfil → Funciones inteligentes → *Modelos*, o con el selector «Modelo» del Planificador.

## Tu ciudad

Pantalla **Ciudad** (y un resumen en Inicio). Cada área de la app es un edificio que sube de nivel (0 = solar en obras, hasta 5) con lo que ya haces: **no hay que registrar nada más**, todo se calcula a partir de tus datos.

| Edificio | Área | Puntos | Niveles (umbral de puntos) |
| --- | --- | --- | --- |
| 🏠 **Casa** | Hábitos | 1 por hábito cumplido | Tienda de campaña (5) · Cabaña (25) · Casita (75) · Casa familiar (200) · Mansión (500) |
| 📚 **Biblioteca** | Conocimiento | 1 por tema completado · 1 por repaso superado · 3 por tema dominado | Estante (5) · Librería (20) · Biblioteca (60) · Gran biblioteca (150) · Archivo legendario (350) |
| 🏫 **Academia** | Cursos | 3 por módulo completado · 10 por curso terminado · 1 por hora de estudio | Aula (6) · Escuelita (25) · Academia (70) · Instituto (160) · Universidad (350) |
| 💻 **Laboratorio** | Proyectos | 2 por checkpoint · 10 por proyecto terminado · 2 por hito de una meta | Taller (4) · Laboratorio (16) · Centro de pruebas (45) · Instituto de I+D (110) · Fábrica de ideas (250) |
| 🏟️ **Arena** | Retos | 3 por jefe derrotado · 5 por reto semanal · 2 por combo ×2 · 1 por Pomodoro | Pista (5) · Gimnasio (20) · Arena (55) · Estadio (130) · Coliseo (300) |
| 🏆 **Museo** | Logros y certificaciones | 1 por logro desbloqueado · 1 por certificación registrada | Vitrina (3) · Sala de honor (8) · Museo (16) · Gran museo (28) · Palacio de los récords (40) |

- **Mejorar un edificio da monedas**: +50, +100, +200, +400 y +800 por alcanzar los niveles 1 a 5, con aviso y mensaje en el buzón. Si saltas varios niveles a la vez, cobras todos. Deshacer o borrar datos **no baja** lo ya conseguido ni repite premios.
- **Sin premios retroactivos**: la primera vez que se comprueba la ciudad solo se anota tu punto de partida (no se regalan monedas por progreso anterior a la ciudad).
- El **rango de la ciudad** sube con la suma de niveles (0-30): Terreno en obras → Aldea (3) → Pueblo (8) → Ciudad (14) → Metrópolis (21) → Capital legendaria (28). Al crecer aparecen árboles, una fuente, farolas y banderas, y suma **habitantes** (tu XP y cada mejora).
- Al pulsar un edificio ves sus 5 niveles con su recompensa, **cómo se ganan los puntos**, cuánto falta y un botón a la pantalla donde mejorarlo. La ciudad te señala cuál está **más cerca de subir**.
- Los edificios se **dibujan por código** (cada uno tiene 5 niveles que crecen y ganan detalles), y hay **5 logros nuevos** (Primera piedra, Sin solares vacíos, Alcalde, Urbanista y Obra maestra). El nivel de cada edificio ya celebrado se guarda en tu perfil (también en las copias de seguridad).

## Tu héroe 3D

Pantalla **Héroe 3D** (menú *Tu juego*). La primera vez eliges raza y nombre; mientras eliges puedes ver cómo será cada raza en sus cuatro etapas.

| Raza | De… | Destaca en | Evoluciona así |
| --- | --- | --- | --- |
| **Saiyajin** | Dragon Ball | Fuerza y energía | Guerrero Saiyajin → Super Saiyajin (pelo dorado y aura) → Super Saiyajin 2 (rayos) → Super Saiyajin 3 (melena hasta la cintura) |
| **Mario** | Super Mario | Velocidad | Mario pequeño → Súper Mario → Mario de fuego (con bolas de fuego) → Mario capa |
| **Koopa** | Super Mario | Defensa | Koopa Troopa → Koopa Paratroopa (alas) → Hermano Martillo (casco y martillo) → Rey Bowser |
| **Protoss** | StarCraft | Energía | Zelote (hojas psiónicas) → Alto Templario (túnica, levita) → Templario Oscuro → Arconte de pura energía |
| **Terran** | StarCraft | Defensa | Recluta → Marine (hombreras y rifle gauss) → Firebat (lanzallamas) → Comandante (mochila propulsora) |
| **Zerg** | StarCraft | Velocidad y fuerza | Zergling → Hidralisco (capucha de cobra) → Ultralisco (cuchillas gigantes) → Reina de Espadas |

Son **fan art en bloques** hecho para este proyecto personal: los personajes pertenecen a sus dueños (ver [Créditos y marcas](#créditos-y-marcas)). Si le pones una skin, cambia los colores de cualquier etapa; sin skin, cada etapa lleva sus colores propios (Mario de fuego en blanco y rojo, el Templario Oscuro en negro y verde…).

- **Evolución**: cuatro etapas, en los niveles 1, 5, 10 y 16. El nivel la **habilita** y tú pulsas **«Evolucionar»**: el héroe da una vuelta, crece y se ilumina. Cuando cruzas el nivel de una etapa nueva te llega un aviso. Cada etapa multiplica las estadísticas (×1,15 · ×1,35 · ×1,6), hace crecer el modelo y desbloquea objetos nuevos en la tienda.
- **Estadísticas**: fuerza, defensa, velocidad y energía. Todas las razas suman lo mismo, cada una repartido a su manera; crecen con tu nivel, se multiplican con la etapa y el arma y el poder suman su extra. El **poder** es la suma de las cuatro.
- **Tienda del héroe** (con las monedas de siempre): **8 armas** (espada, martillo, arco, bastón, cañón de plasma, garras, hoja de luz, lanza estelar), **6 poderes** con efecto visible (chispas, escarcha, escudo, llamas, rayos, alas de luz) y **8 skins** que recolorean a cualquier raza. Los objetos de etapas altas salen con candado. Al comprar algo se equipa solo, y **«Probar»** te lo pone en el modelo sin comprarlo y te enseña cómo cambiaría tu poder.
- **Cambiar de raza o de nombre es gratis**: conservas etapa y objetos.
- **4 logros nuevos**: Nace un héroe, Primera evolución, Leyenda viviente y Armería completa.
- **Cómo está hecho**: el modelo lo calcula `core/hero.ts` (código puro, probado sin navegador) y el visor lo pinta con [three.js](https://threejs.org) a baja resolución. three.js va en su propio archivo y solo se descarga al abrir la pantalla. Sin WebGL, la pantalla lo explica en vez de romperse.
- El héroe se guarda **dentro del perfil** (no hace falta migración en Supabase) y viaja en las copias de seguridad; al importar, un héroe solo puede llevar objetos que están en el inventario.

## Repaso espaciado, calendario, jefes y Pomodoro

**Repaso espaciado (Repaso).** Marca un tema como *«Necesito repasar»* dentro de un curso: reaparece **al día siguiente** y, cada vez que lo recuerdas, a los **3, 7 y 14 días**. Fallar reinicia la escalera; superar los cuatro escalones deja el tema **dominado** (+40 XP). Cada repaso superado da +10 XP. Las tarjetas son tuyas: botón **♪ Tarjetas** en cada tema, una por línea con el formato `pregunta :: respuesta` (si no hay ninguna, se te pregunta si recuerdas el tema). Atajos: `espacio` gira la tarjeta, `1` `2` `3` califican. La agenda se ve también en el calendario y en el menú (insignia con lo que toca hoy).

**Calendario.** Tareas por fecha límite (color por prioridad, ↻ las repetidas, tachadas las hechas), repeticiones futuras proyectadas y repasos. Pulsa un día para ver su detalle y crear una tarea con esa fecha; arrastra una tarea a otro día para moverla.

**Tareas recurrentes.** En el formulario, *Repetir*: cada N días, semanas o meses. Al completarla **nace la siguiente**, con su nueva fecha y sin avance. La fecha sigue el calendario original pero nunca cae en el pasado (completar tarde no crea una cola de atrasadas; 31 ene + 1 mes = 28/29 feb). Si la reabres y nadie tocó la siguiente, esta se retira.

**Ponerse al día con un hábito olvidado.** Puedes marcar los últimos 7 días de la tira semanal de cada hábito. El XP se fecha en el día que corresponde, así que repara la racha; los bonos del día no se cobran hacia atrás.

**Jefes finales.** Una tarea con prioridad *Jefe final* y subtareas es una batalla: **cada subtarea es un golpe** y le quita un corazón. Al caer el último, el jefe se derrota solo: pantalla de **victoria**, su XP y un **botín extra de +50 XP**. Reabrir el jefe le devuelve toda la vida.

**Pomodoro.** 25 min de enfoque + 5 de descanso (configurable), y descanso largo cada 4. Cada enfoque terminado se registra como sesión de estudio (2 XP/min). Suena una melodía 8-bit animada para estudiar y otra tranquila para descansar (**original y sintetizada**, sin archivos); se controla con el botón «Música 8-bit». El reloj aparece en la barra superior desde cualquier pantalla y en el título de la pestaña, y sobrevive a recargar la página.

**Eventos de racha.**

| Evento | Cuándo | Qué da |
| --- | --- | --- |
| **Bonus de fin de semana** | Sábado y domingo, por cada hábito completado | **+50%** de su XP |
| **Combo ×2** | Al completar **3 hábitos** en el mismo día | Duplica el XP de esos hábitos (tope 200) |
| **Cofre diario** | Una vez al día en Inicio | 20–60 monedas + 2 por cada día de racha (máx. +60) y, a veces, +25 XP |

Los bonos se cobran **una sola vez** (se anotan en el perfil): deshacer y rehacer un hábito no los repite.

## Reglas del juego

| Concepto | Regla |
| --- | --- |
| **Nivel** | El nivel *L* cuesta `250 × L` XP (nivel 12 → 3 000 XP). Cada nivel tiene un mundo (`3-4`) y un rango. |
| **Monedas** | 1 moneda por cada 4 XP. Subir de nivel da +500. Cada logro da su premio. |
| **Tarea** | Da su XP al pasar a *Superada*. Reabrirla lo devuelve. Prioridad: baja 20 · media 35 · alta 50 · jefe final 120 (+50 de botín al derrotarlo). |
| **Hábito** | Da su XP al alcanzar el objetivo del día, **una sola vez**. Bajar del objetivo lo devuelve. |
| **Tema de curso** | XP del módulo repartido entre sus temas. |
| **Sesión de estudio** | 2 XP por minuto (también cada Pomodoro de enfoque). |
| **Repaso** | +10 XP por repaso superado; +40 más al dominar el tema. |
| **Reto semanal** | Alcanzar tus horas objetivo (15 h por defecto) desbloquea +200 XP. |
| **Racha** | Días consecutivos con XP neto positivo. Si hoy aún no hay actividad, la racha de ayer sigue viva hasta que acabe el día. |
| **Congelar racha** | Poder de la tienda (×3): marca un día como activo sin ganar XP. |
| **Progreso de curso** | Temas completados / totales. Un módulo se completa con todos sus temas y desbloquea el siguiente. |

## Arquitectura

```mermaid
flowchart LR
  UI["features/ + ui/<br/>pantallas y componentes"] --> Store["state/<br/>stores (zustand) + reglas de juego"]
  Store --> Core["core/<br/>dominio puro"]
  Store --> Ports["data/ports.ts<br/>Repository · AuthPort"]
  Ports -.-> Local["data/local<br/>localStorage"]
  Ports -.-> Supa["data/supabase<br/>Postgres + Auth"]
  Ports -.-> Otro["data/tu-adaptador<br/>(lo que necesites)"]
```

```
src/
├─ core/       Dominio puro (sin React ni BD): tipos, niveles y XP, rachas, hábitos,
│              logros, catálogo de la tienda, misiones y datos de ejemplo
├─ data/
│  ├─ ports.ts      ← contratos: Repository y AuthPort
│  ├─ local/        ← adaptador localStorage (y almacén en memoria para tests)
│  ├─ supabase/     ← adaptador Supabase: tablas, columnas, RLS y auth
│  ├─ offline/      ← decorador con cola de escritura offline (IndexedDB), válido para cualquier adaptador
│  └─ index.ts      ← ÚNICO sitio que decide qué adaptador se usa
├─ state/      data.ts (datos + reglas de juego) · ui.ts (toasts, modales, tema, sonido)
├─ features/   Una carpeta por pantalla, más layout y modales
├─ ui/         Componentes base y sprites pixel-art (sprites.ts)
├─ audio/      Efectos 8-bit con Web Audio
└─ pwa/        Hooks de conexión e instalación, y cliente de notificaciones push
supabase/
├─ migrations/   Esquema SQL con RLS (0001 base · 0002 recordatorios · 0005 certificaciones · 0006 apuntes)
├─ functions/    Edge Function `send-reminders` (+ `_shared/due.ts`, espejo de las reglas de «¿toca hoy?»)
└─ cron.sql.example   Programación del envío cada minuto
public/push-sw.js      Manejo de notificaciones dentro del service worker
docs/screenshots/      Capturas del README
```

**Decisiones de diseño que conviene conocer**

- **UI optimista con reversión.** Cada acción actualiza la pantalla al instante y se guarda en segundo plano; si falla, se revierte y se avisa. Las escrituras pasan por una cola que conserva el orden.
- **Los ids los genera el cliente** (`crypto.randomUUID`), así crear es idempotente y no depende del servidor.
- **Documentos `jsonb` + tablas relacionales.** Tareas, hábitos, cursos, metas y proyectos tienen estructura anidada que cambia a menudo (módulos → temas, subtareas, hitos), así que se guardan como documentos. Los registros de actividad (`habit_logs`, `study_sessions`, `xp_events`, `notifications`) son tablas relacionales porque se agregan por fecha.
- **Tienda y logros viven en código** (`core/catalog.ts`, `core/achievements.ts`): cambiarlos no exige migración.
- **Fechas de negocio = día local `YYYY-MM-DD`, no UTC.** Así «hoy» es hoy en tu zona horaria (con UTC, a las 19:00 en Perú ya sería «mañana»).
- **Sprites propios.** Son cuadrículas de texto (`sprites.ts`) que se dibujan como SVG nítido; una prueba comprueba que cada una está bien formada.

## Cambiar de base de datos

La app solo conoce las interfaces `Repository` y `AuthPort` ([`src/data/ports.ts`](src/data/ports.ts)). Para migrar a Firebase, PocketBase, tu propia API…:

**1.** Crea `src/data/pocketbase/index.ts` que devuelva un `DataLayer`:

```ts
import type { DataLayer } from '../ports';

export function createPocketBaseDataLayer(url: string): DataLayer {
  return {
    kind: 'pocketbase',          // amplía la unión `kind` en ports.ts
    repo: { /* profile, tasks, habits, habitLogs, courses, goals, projects,
               personalRewards, sessions, xpEvents, notifications, wipe */ },
    auth: { /* required, getUser, onChange, signInWithPassword, signUp,
                signInWithMagicLink, signInWithGoogle, signOut */ },
  };
}
```

**2.** Regístralo en [`src/data/index.ts`](src/data/index.ts):

```ts
if (provider === 'pocketbase') return createPocketBaseDataLayer(env.VITE_POCKETBASE_URL);
```

**3.** Pon `VITE_DATA_PROVIDER=pocketbase` y listo. El store, las pantallas y las reglas de juego no cambian. [`src/data/local/local.test.ts`](src/data/local/local.test.ts) sirve de modelo para probar el adaptador nuevo.

Puntos a respetar en el adaptador: `habitLogs.upsert` debe ser **único por hábito y día**; `habitLogs.removeByHabit` borra de golpe el historial de un hábito (al borrarlo); `create` debe ser **idempotente** por id (se usa también para guardar cambios en lote); y `wipe()` debe borrar todo lo del usuario. `repo.push` es opcional (solo si tu backend puede enviar recordatorios). Si tu backend es remoto, envuélvelo con `withOfflineQueue(...)` en `data/index.ts` y ganas el trabajo sin conexión gratis. Las copias de seguridad JSON funcionan con cualquier adaptador y permiten llevarte tus datos de uno a otro.

## Modelo de datos

| Tabla | Tipo | Contenido |
| --- | --- | --- |
| `profiles` | `data jsonb` | Nombre, XP, monedas, inventario, equipado, logros, congeladores |
| `tasks` · `habits` · `courses` · `goals` · `projects` · `personal_rewards` | `data jsonb` | Entidades con estructura anidada |
| `habit_logs` | relacional | `habit_id`, `day`, `value`, `steps_done` — único por `(user_id, habit_id, day)` |
| `study_sessions` | relacional | `day`, `minutes`, `course_id` |
| `xp_events` | relacional | `day`, `amount`, `source`, `label` — fuente de la racha y del mapa de actividad |
| `notifications` | relacional | `category`, `title`, `body`, `read` |
| `push_subscriptions` | relacional | Dispositivos suscritos a push: `endpoint`, claves, `timezone` — único por `(user_id, endpoint)` *(migración 0002)* |
| `reminder_log` | relacional | Avisos ya enviados, `(user_id, habit_id, day)`. Solo accesible por la Edge Function *(migración 0002)* |

Todas llevan `user_id` (por defecto `auth.uid()`) y una política RLS «solo el dueño».

## Pruebas

```bash
npm test
```

Cubren la lógica que más importa: curva de niveles y rachas, frecuencias de hábito, el store completo (XP, monedas, deshacer, reversión si falla el guardado), la cola offline, las copias de seguridad, los planificadores de avisos y de rutas, el cliente de IA (con el SDK simulado), la ciudad, el repaso espaciado, los jefes, y la validez de sprites, catálogo y logros.


## Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| Aparece el **login** en local | Tu `.env` tiene `VITE_DATA_PROVIDER=supabase`. Cámbialo a `local` para trabajar sin backend. |
| Inicias sesión pero **no se guarda nada** / error `relation "…" does not exist` | No has ejecutado la migración. Corre `0001_init.sql` en el SQL Editor. |
| Error `42501` / `row-level security` | La migración se ejecutó a medias. Vuelve a lanzarla completa (es idempotente). |
| `Invalid API key` | Copiaste la clave equivocada o quedó cortada. Usa la *anon public* de Project Settings → API. |
| El enlace del correo lleva a `localhost` o a un sitio equivocado | Falta tu URL en Authentication → URL Configuration. |
| En Render: `npm error Missing script: "start"` | Creaste un *Web Service*. Lo correcto es un **Static Site** (gratis, sin servidor) o usar el Blueprint. Si prefieres seguir con Web Service: Start Command `npm start` (el repo ya trae ese script; sirve `dist` en el `PORT` de Render). |
| En Render, recargar `/tareas` da **404** | Falta la regla *Rewrite* `/* → /index.html` (ya está en `render.yaml`). |
| Cambié las variables en Render y no pasa nada | Son variables de *build*: lanza un nuevo despliegue. |
| La PWA no se actualiza | Cierra todas las pestañas o pulsa «Actualizar» en el aviso. Comprueba que `sw.js` no esté cacheado por un CDN. |
| El planificador no muestra «Generar con IA» | Falta activar las funciones inteligentes: pulsa «🔑 Activar funciones inteligentes» (o ve a Perfil) y pega tu clave de Google AI Studio. |
| Al guardar la clave en mi cuenta sale un error | Falta ejecutar `0004_user_secrets.sql` en el SQL Editor de Supabase. La clave sí funciona en el dispositivo mientras tanto. |
| Al guardar un apunte sale un error | Falta ejecutar `0006_notes.sql` en el SQL Editor de Supabase (crea la tabla `notes`). |
| Al registrar una certificación sale un error al guardar | Falta ejecutar `0005_certifications.sql` en el SQL Editor de Supabase (crea la tabla `certifications`). |
| «Frase incorrecta» al desbloquear | La frase es la que elegiste al guardarla (distingue mayúsculas). Si la perdiste, pulsa «Olvidé mi frase», que borra la copia cifrada de tu cuenta, y pega la clave otra vez (la sigues viendo en Google AI Studio). |
| «Google no aceptó tu clave» | La clave está mal copiada, borrada o restringida. Crea otra en [Google AI Studio](https://aistudio.google.com/apikey) y pégala de nuevo (Perfil → Funciones inteligentes). |
| «Se agotó la cuota gratuita…» | El modelo llegó a su límite por minuto o por día (los límites son por proyecto y por modelo). Con el cambio automático activado la app prueba otros modelos gratuitos sola; si todos se agotaron, espera unos minutos (o a medianoche, hora del Pacífico, para el límite diario) o usa una plantilla. Puedes ver tus cifras en aistudio.google.com/rate-limit. |
| Los recordatorios no llegan | Comprueba en orden: (1) Perfil → Recordatorios dice «Activados»; (2) el hábito tiene hora, **hoy le toca** y no está hecho; (3) migración 0002 ejecutada; (4) función desplegada con `--no-verify-jwt` y los 4 secretos; (5) el cron corre (`cron.job_run_details`); (6) en iPhone, la app está instalada y es iOS 16.4+. Prueba la función con el `curl` de la sección de recordatorios. |
| Los avisos repetidos no llegan (solo el primero) | Falta ejecutar `0003_reminder_repeats.sql` o **volver a desplegar la función** (`npx supabase functions deploy send-reminders …`). |
| En Perfil → Recordatorios sale «Falta la clave pública VAPID» | Falta `VITE_VAPID_PUBLIC_KEY` en el build. Añádela (`.env` / Render) y **vuelve a desplegar**. |
| En Perfil → Recordatorios sale «El service worker no está activo» | Estás en `npm run dev`. Usa `npm run build && npm run preview`. |
| Muestra `⏳ N pendientes` y no baja | Sigues sin conexión o la sesión caducó. Con red, púlsalo para reintentar; si la sesión caducó, vuelve a iniciar sesión (los cambios pendientes se conservan). |
| Al importar dice «No parece una copia de StudyQuest» | Solo se admiten archivos exportados desde Perfil → Exportar copia. |
| «Continuar con Google» da error `provider is not enabled` o `redirect_uri_mismatch` | Falta activar Google en Supabase → Authentication → Providers, o el *URI de redireccionamiento* de Google Cloud no es exactamente `https://<ref>.supabase.co/auth/v1/callback`. Ver [Iniciar sesión con Google](#iniciar-sesión-con-google). |
| Al entrar con Google sale `{"error":"requested path is invalid"}` | Es Supabase rechazando la URL de retorno. En **Authentication → URL Configuration**: pon como **Site URL** la de tu app (`https://tu-app.onrender.com`, sin barra final ni rutas) y en **Redirect URLs** añade `https://tu-app.onrender.com/**` y `http://localhost:5173/**`. Comprueba también que `VITE_SUPABASE_URL` sea solo `https://<ref>.supabase.co`. |
| Supabase limita los correos | El plan gratuito envía pocos correos por hora. Para pruebas, desactiva *Confirm email* o usa contraseña en vez de enlace mágico. |

## Límites conocidos
- **Cola offline:** ante conflictos entre dispositivos gana la última escritura (*last write wins*).
- **El héroe 3D necesita WebGL** (cualquier navegador actual lo tiene). Sin él se ve la ficha y la tienda, pero no el modelo.
- **Arrastrar y soltar solo con ratón/trackpad.** En pantallas táctiles y con teclado se usan los botones *Empezar / Completar / Reabrir*.
- **Recordatorios con precisión de minuto**: el primer aviso admite hasta 10 minutos de retraso (si el cron falla más, ese día no llega), el intervalo mínimo entre repeticiones es 15 min y la zona horaria es la del último dispositivo activado.
- **El aviso dentro de la app solo funciona con la app abierta** (una pestaña en segundo plano puede ralentizar sus temporizadores hasta ~1 min). Con la app cerrada solo avisa el push.
- Si marcas un hábito como hecho **sin conexión**, el servidor no lo sabe hasta que sincronice y puede llegar algún aviso de más.


## Créditos y marcas

Proyecto personal sin fines comerciales. Los sprites son dibujos propios inspirados en la estética 8-bit; **Mario, Luigi, Yoshi, Bowser, Pac-Man, Zelda, Minecraft, Sonic, Metroid, Dragon Ball, StarCraft y demás nombres o personajes mencionados pertenecen a sus respectivos dueños** y se usan solo como guiño. Las razas del héroe 3D son fan art de Dragon Ball (Saiyajin), Super Mario (Mario, Koopa, Bowser) y StarCraft (Protoss, Terran, Zerg). Motor 3D: [three.js](https://github.com/mrdoob/three.js) (licencia MIT). Fuentes: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) y [Nunito](https://fonts.google.com/specimen/Nunito) (SIL Open Font License), empaquetadas con [Fontsource](https://fontsource.org).
