create table public.configuracion_resumen_diario (
  id boolean primary key default true check (id),
  habilitado boolean not null default false,
  hora_envio time not null default '17:00',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid
);

insert into public.configuracion_resumen_diario (id)
values (true)
on conflict (id) do nothing;

alter table public.configuracion_resumen_diario enable row level security;

create policy "configuracion_resumen_diario_sel"
  on public.configuracion_resumen_diario
  for select to authenticated
  using (public.es_autorizado());
create policy "configuracion_resumen_diario_upd"
  on public.configuracion_resumen_diario
  for update to authenticated
  using (public.es_autorizado())
  with check (public.es_autorizado());

create trigger "configuracion_resumen_diario_touch"
  before update on public.configuracion_resumen_diario
  for each row execute function public.touch();

grant select, update on public.configuracion_resumen_diario to authenticated;

create table public.resumen_diario_automatico_ejecuciones (
  fecha date primary key,
  reclamado_en timestamptz not null default now()
);

alter table public.resumen_diario_automatico_ejecuciones enable row level security;

create or replace function public.reclamar_envio_resumen_automatico()
returns date
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_config public.configuracion_resumen_diario%rowtype;
  v_hora_local timestamp;
  v_fecha_local date;
begin
  select * into v_config
  from public.configuracion_resumen_diario
  where id = true;

  if not found or not v_config.habilitado then
    return null;
  end if;

  v_hora_local := timezone('America/Argentina/Buenos_Aires', now());
  v_fecha_local := v_hora_local::date;

  if extract(isodow from v_fecha_local) not between 1 and 5
    or v_hora_local < v_fecha_local + v_config.hora_envio
    or v_hora_local >= v_fecha_local + v_config.hora_envio + interval '2 minutes' then
    return null;
  end if;

  insert into public.resumen_diario_automatico_ejecuciones (fecha)
  values (v_fecha_local)
  on conflict (fecha) do nothing;

  if not found then
    return null;
  end if;

  return v_fecha_local;
end;
$$;

revoke all on function public.reclamar_envio_resumen_automatico() from public, anon, authenticated;
grant execute on function public.reclamar_envio_resumen_automatico() to service_role;

do $$
declare
  v_job_id bigint;
  v_command text;
  v_schedule text;
  v_secret text;
  v_url text;
  v_schedule_parts text[];
  v_hora time;
  v_new_command text;
  v_new_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron no está habilitado. Configurá el job resumen-diario según README.md.';
    return;
  end if;

  execute 'select jobid, command, schedule from cron.job where jobname = $1 order by jobid desc limit 1'
    into v_job_id, v_command, v_schedule
    using 'resumen-diario';

  if v_job_id is null then
    raise notice 'No existe un job resumen-diario anterior. Configurá el job según README.md.';
    return;
  end if;

  v_secret := (regexp_match(v_command, '"x-cron-secret"\s*:\s*"([^"]+)"'))[1];
  v_url := (regexp_match(v_command, '(https://[^'']+/functions/v1/resumen-diario)'))[1];
  v_schedule_parts := regexp_match(v_schedule, '^([0-5]?[0-9]) ([0-9]|1[0-9]|2[0-3]) \* \* \*$');

  if v_secret is null or v_url is null or v_schedule_parts is null then
    raise exception 'No se pudo migrar el job resumen-diario de forma segura. No se modificó el cron existente; revisá README.md.';
  end if;

  v_hora := make_time((v_schedule_parts[2]::integer + 21) % 24, v_schedule_parts[1]::integer, 0);
  v_new_command := format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    v_url,
    jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret)::text,
    jsonb_build_object('automatico', true)::text
  );

  execute 'select cron.unschedule($1)' using v_job_id;
  execute 'select cron.schedule($1, $2, $3)'
    into v_new_job_id
    using 'resumen-diario', '* * * * *', v_new_command;

  update public.configuracion_resumen_diario
  set habilitado = true, hora_envio = v_hora
  where id = true;
end;
$$;
