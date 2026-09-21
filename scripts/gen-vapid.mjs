/**
 * Genera un par de claves VAPID para Web Push (sin dependencias, con node:crypto).
 * Uso: npm run vapid
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
// Clave pública en formato "punto sin comprimir" (0x04 || X || Y), como espera PushManager.subscribe.
const publicRaw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);

const pubB64 = publicRaw.toString('base64url');

console.log(`
Claves VAPID generadas. Guárdalas: si las cambias, todas las suscripciones existentes dejan de funcionar.

━━ 1) FRONTEND ━━ va en tu .env y en las variables de Render (y vuelve a desplegar):
VITE_VAPID_PUBLIC_KEY=${pubB64}

━━ 2) SUPABASE ━━ va en un archivo "supabase.secrets.local" (ya lo ignora git). NUNCA en el .env:
VAPID_PUBLIC_KEY=${pubB64}
VAPID_PRIVATE_KEY=${priv.d}
VAPID_SUBJECT=mailto:tu@correo.com
CRON_SECRET=<cadena aleatoria: node -e "console.log(require('crypto').randomBytes(24).toString('hex'))">

Luego:
  npx supabase secrets set --env-file supabase.secrets.local --project-ref <ref>
  npx supabase functions deploy send-reminders --no-verify-jwt --use-api --project-ref <ref>

⚠ La clave PRIVADA es un secreto: no la pegues en chats, issues ni commits.
`);
