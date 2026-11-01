-- Esquema completo y final de App Cobranzas. Para un proyecto nuevo alcanza con ejecutar SOLO este archivo.
-- Solo el usuario autorizado pasa las políticas RLS (se valida en la base, no en la UI)
create or replace function public.es_autorizado() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'mferreyra@oca.com.ar'
$$;

create or replace function public.touch() returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end $$;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, numero_sap text unique,
  telefono text, correo text, direccion text, notas text,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

create table cobros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  monto numeric(14,2) not null check (monto > 0),
  forma_pago text not null check (forma_pago in ('efectivo','cheque')),
  observaciones text,
  estado text not null default 'registrado' check (estado in ('registrado','confirmado','anulado')),
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

-- Varios cheques por cobro; todos los datos son opcionales salvo el monto
create table cheques (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references cobros(id),
  numero text, banco text, titular text, fecha_cobro date,
  monto numeric(14,2) not null, foto_path text,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

-- Facturas: solo se anota el número y si quedó pagada o con pago parcial
create table cobro_factura (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references cobros(id),
  numero_factura text not null,
  tipo text not null default 'pagada' check (tipo in ('pagada','parcial')),
  monto_aplicado numeric(14,2),
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

create table gestiones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id), contacto text,
  tipo text not null check (tipo in ('deposito','gestion','retiro_documentacion','entrega_documentacion','otros')),
  observaciones text,
  estado text not null default 'realizada' check (estado in ('realizada','pendiente','anulada')),
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now(),
  constraint gestiones_otros_desc check (tipo <> 'otros' or length(trim(coalesce(observaciones, ''))) > 0));

create table destinatarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, correo text not null,
  activo boolean not null default true, recibe_resumen boolean not null default true,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

-- Si se elimina un destinatario, el envío ya hecho conserva su correo
create table envios (
  id uuid primary key default gen_random_uuid(),
  fecha_envio timestamptz not null default now(),
  destinatario_id uuid references destinatarios(id) on delete set null, destinatario_correo text,
  contenido text, estado text not null check (estado in ('enviado','error')), error text,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

-- RLS en todas las tablas: leer, crear y modificar. No hay borrado físico (se anula)...
do $$ declare t text; begin
  foreach t in array array['clientes','cobros','cheques','cobro_factura','gestiones','destinatarios','envios'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%1$s_sel" on %1$I for select to authenticated using (es_autorizado())', t);
    execute format('create policy "%1$s_ins" on %1$I for insert to authenticated with check (es_autorizado())', t);
    execute format('create policy "%1$s_upd" on %1$I for update to authenticated using (es_autorizado()) with check (es_autorizado())', t);
    execute format('create trigger "%1$s_touch" before update on %1$I for each row execute function touch()', t);
  end loop;
end $$;

-- ...salvo los destinatarios, que sí se pueden eliminar desde la app
create policy "destinatarios_del" on destinatarios for delete to authenticated using (es_autorizado());

-- Fotos de cheques: almacenamiento privado, solo el usuario autorizado
insert into storage.buckets (id, name, public) values ('cheques', 'cheques', false) on conflict (id) do nothing;
create policy "cheques_fotos_sel" on storage.objects for select to authenticated
  using (bucket_id = 'cheques' and public.es_autorizado());
create policy "cheques_fotos_ins" on storage.objects for insert to authenticated
  with check (bucket_id = 'cheques' and public.es_autorizado());
