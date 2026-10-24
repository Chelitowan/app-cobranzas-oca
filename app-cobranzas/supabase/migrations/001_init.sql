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

create table facturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  numero text not null, monto_total numeric(14,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','parcialmente pagada','pagada')),
  emision date, vencimiento date,
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

create table cheques (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references cobros(id),
  numero text not null, banco text not null, titular text not null,
  fecha_cobro date not null, monto numeric(14,2) not null,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

create table cobro_factura (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references cobros(id),
  factura_id uuid not null references facturas(id),
  monto_aplicado numeric(14,2) not null check (monto_aplicado > 0),
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

create table gestiones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id), contacto text,
  tipo text not null check (tipo in ('deposito','entrega_documentos','retiro_documentos','consulta_contacto','llamada','pendiente')),
  observaciones text,
  estado text not null default 'realizada' check (estado in ('realizada','pendiente','anulada')),
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

create table destinatarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, correo text not null,
  activo boolean not null default true, recibe_resumen boolean not null default true,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

create table envios (
  id uuid primary key default gen_random_uuid(),
  fecha_envio timestamptz not null default now(),
  destinatario_id uuid references destinatarios(id), destinatario_correo text,
  contenido text, estado text not null check (estado in ('enviado','error')), error text,
  creado_por uuid default auth.uid(), creado_en timestamptz not null default now(),
  actualizado_por uuid, actualizado_en timestamptz not null default now());

-- RLS en todas las tablas. Sin política de DELETE => no hay borrado físico
do $$ declare t text; begin
  foreach t in array array['clientes','facturas','cobros','cheques','cobro_factura','gestiones','destinatarios','envios'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%1$s_sel" on %1$I for select to authenticated using (es_autorizado())', t);
    execute format('create policy "%1$s_ins" on %1$I for insert to authenticated with check (es_autorizado())', t);
    execute format('create policy "%1$s_upd" on %1$I for update to authenticated using (es_autorizado()) with check (es_autorizado())', t);
    execute format('create trigger "%1$s_touch" before update on %1$I for each row execute function touch()', t);
  end loop;
end $$;

-- Saldo de cada factura = total - lo aplicado por cobros no anulados
create view facturas_saldo with (security_invoker = true) as
select f.*, f.monto_total - coalesce((
  select sum(cf.monto_aplicado) from cobro_factura cf join cobros c on c.id = cf.cobro_id
  where cf.factura_id = f.id and c.estado <> 'anulado'), 0) as saldo
from facturas f;
grant select on facturas_saldo to authenticated;
