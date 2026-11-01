# App Cobranzas — Fase 1 (login, cobros, historial, resumen diario)

Colores del logo OCA: morado `#572A82`, naranja `#F39430`, blanco (ver `src/styles.css`).

## 1. Base de datos
1. Creá un proyecto en supabase.com.
2. Para un proyecto nuevo, ejecutá en orden `supabase/migrations/001_init.sql`, `005_guardado_atomico_cobro.sql` y `006_almuerzos.sql` desde SQL Editor. Las migraciones `002` y `003` son de una versión anterior del esquema y no se necesitan en una instalación nueva.
   Si ya habías instalado la versión anterior ejecutando `001`, `002` y `003`, ejecutá en orden `004_funcionalidad_app.sql`, `005_guardado_atomico_cobro.sql` y `006_almuerzos.sql`. Si ya tenías aplicada `001` con el esquema final, ejecutá `005_guardado_atomico_cobro.sql` y `006_almuerzos.sql`.
3. Authentication → Providers → Email: **desactivá "Allow new users to sign up"**.
4. Authentication → Users → *Add user* → creá `mferreyra@oca.com.ar` y marcá "Auto confirm". Ese correo está fijado en la política RLS de `001_init.sql`; si vas a usar otro, cambiá también allí la función `es_autorizado()`. Configurá el mismo correo autorizado en el frontend y en la función de correo.

## 2. Frontend
```bash
npm install
cp .env.example .env   # completá las tres variables siguientes
npm run dev
```
En `.env`, configurá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde Project Settings → API, y `VITE_EMAIL_AUTORIZADO` con el correo del usuario autorizado. No pongas claves secretas en las variables `VITE_`.

Probá: ingresá con el usuario → "Nuevo cobro". En el cobro agregás a mano los números de factura (pagada o pago parcial).
Cargá los destinatarios desde la pantalla "Destinatarios". Para ejecutar el servidor local, corré los comandos desde la carpeta `app-cobranzas`.

## 3. Resumen por correo (Edge Function + Resend)
En Resend, creá una API key y verificá el dominio o la dirección que usarás como remitente. Configurá los secretos en Supabase (no en el `.env` del frontend):
```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_REF
supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="Cobranzas <cobranzas@tudominio.com>" EMAIL_AUTORIZADO=mferreyra@oca.com.ar CRON_SECRET=un_secreto_largo
supabase functions deploy resumen-diario --no-verify-jwt
```
Reemplazá los ejemplos por tus valores reales. `EMAIL_AUTORIZADO` debe coincidir con el correo autorizado en la base de datos y en `VITE_EMAIL_AUTORIZADO`. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los proporciona el runtime de Supabase; no los incluyas en el frontend. Probá con "Enviar resumen ahora" en Historial.

### Diagnósticos de Edge Functions en VS Code
Instalá el CLI de Deno y la extensión oficial **Deno** (`denoland.vscode-deno`). La configuración del workspace activa Deno solo en `supabase/functions` para no interferir con el TypeScript de React/Vite. Después de instalar la extensión, recargá la ventana de VS Code.

## 4. Envío automático a las 17:00 (Argentina = 20:00 UTC)
Activá las extensiones `pg_cron` y `pg_net` (Database → Extensions) y ejecutá en SQL Editor:
```sql
select cron.schedule('resumen-diario', '0 20 * * *', $$
  select net.http_post(
    url := 'https://TU_REF.supabase.co/functions/v1/resumen-diario',
    headers := '{"Content-Type":"application/json","x-cron-secret":"un_secreto_largo"}'::jsonb,
    body := '{}'::jsonb) $$);
```

El resumen diario también incluye el tiempo de almuerzo y enlaces a las ubicaciones registradas al iniciar y finalizar. La app solicita permiso de ubicación y la captura solo funciona desde un contexto seguro HTTPS (o localhost en el mismo dispositivo); la URL HTTP de red local no permite usar geolocalización en un celular.

## Pendiente
Gestión de clientes (edición e historial) y filtros del historial.

## Usarla en el iPhone
1. Publicá la app (necesita HTTPS), por ejemplo en Vercel o Netlify: ejecutá `npm run build` y publicá la carpeta `dist`, o conectá el repositorio. Cargá en el hosting las tres variables `VITE_...` del `.env`.
2. En Supabase → Authentication → URL Configuration, poné la dirección publicada como *Site URL*.
3. Abrila en Safari → botón Compartir → **Agregar a pantalla de inicio**. Se abre a pantalla completa, como una app, con el ícono de OCA.
