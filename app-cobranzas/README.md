# App Cobranzas — Fase 1 (login, cobros, historial, resumen diario)

Colores del logo OCA: morado `#572A82`, naranja `#F39430`, blanco (ver `src/styles.css`).

## 1. Base de datos
1. Creá un proyecto en supabase.com.
2. SQL Editor → ejecutá `supabase/migrations/001_init.sql` y después `002_facturas_manual.sql` y `003_gestiones.sql`.
3. Authentication → Providers → Email: **desactivá "Allow new users to sign up"**.
4. Authentication → Users → *Add user* → mferreyra@oca.com.ar + contraseña (marcá "Auto confirm").

## 2. Frontend
```bash
npm install
cp .env.example .env   # completá URL y clave anon (Project Settings → API)
npm run dev
```
Probá: ingresá con el usuario → "Nuevo cobro". En el cobro agregás a mano los números de factura (pagada o pago parcial).
Cargá los destinatarios (tu jefe y vos) desde la pantalla "Destinatarios".

## 3. Resumen por correo (Edge Function + Resend)
En Resend, creá una API key y verificá el dominio/dirección que vas a usar como remitente. Configurá los secretos en Supabase (no en el `.env` del frontend):
```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_REF
supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="Cobranzas <cobranzas@tudominio.com>" EMAIL_AUTORIZADO=mferreyra@oca.com.ar CRON_SECRET=un_secreto_largo
supabase functions deploy resumen-diario --no-verify-jwt
```
Las claves quedan solo en el servidor. La función verifica que el usuario autenticado coincida con `EMAIL_AUTORIZADO`; el runtime de Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Probá con "Enviar resumen ahora" en Historial: si Resend rechaza un destinatario, la pantalla muestra el motivo devuelto por la API.

## 4. Envío automático a las 17:00 (Argentina = 20:00 UTC)
Activá las extensiones `pg_cron` y `pg_net` (Database → Extensions) y ejecutá en SQL Editor:
```sql
select cron.schedule('resumen-diario', '0 20 * * *', $$
  select net.http_post(
    url := 'https://TU_REF.supabase.co/functions/v1/resumen-diario',
    headers := '{"Content-Type":"application/json","x-cron-secret":"un_secreto_largo"}'::jsonb,
    body := '{}'::jsonb) $$);
```

## Pendiente (fase 2)
Nueva gestión, Clientes (editar/historial), Destinatarios, filtros del historial, lista de envíos, guardado atómico del cobro (función RPC).

## Usarla en el iPhone
1. Publicá la app (necesita HTTPS), por ejemplo en Vercel o Netlify: `npm run build` y subí la carpeta `dist`, o conectá el repositorio. Cargá en el hosting las 3 variables `VITE_...` del `.env`.
2. En Supabase → Authentication → URL Configuration, poné la dirección publicada como *Site URL*.
3. Abrila en Safari → botón Compartir → **Agregar a pantalla de inicio**. Se abre a pantalla completa, como una app, con el ícono de OCA.
