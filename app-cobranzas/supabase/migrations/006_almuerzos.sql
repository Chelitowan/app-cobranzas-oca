create table public.almuerzos (
  id uuid primary key default gen_random_uuid(),
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  latitud_inicio double precision not null check (latitud_inicio between -90 and 90),
  longitud_inicio double precision not null check (longitud_inicio between -180 and 180),
  latitud_fin double precision check (latitud_fin between -90 and 90),
  longitud_fin double precision check (longitud_fin between -180 and 180),
  creado_por uuid not null default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_por uuid,
  actualizado_en timestamptz not null default now(),
  constraint almuerzos_fin_despues_inicio
    check (finalizado_en is null or finalizado_en >= iniciado_en),
  constraint almuerzos_ubicacion_fin_completa
    check ((latitud_fin is null) = (longitud_fin is null))
);

create unique index almuerzos_uno_activo_por_usuario
  on public.almuerzos (creado_por)
  where finalizado_en is null;

alter table public.almuerzos enable row level security;
create policy "almuerzos_sel" on public.almuerzos
  for select to authenticated using (public.es_autorizado());
create policy "almuerzos_ins" on public.almuerzos
  for insert to authenticated with check (public.es_autorizado());
create policy "almuerzos_upd" on public.almuerzos
  for update to authenticated using (public.es_autorizado())
  with check (public.es_autorizado());
create trigger "almuerzos_touch" before update on public.almuerzos
  for each row execute function public.touch();

grant select, insert, update on public.almuerzos to authenticated;
