-- Mantiene instalaciones que ya habían aplicado las migraciones 001-003.
alter table public.cheques alter column numero drop not null;
alter table public.cheques alter column banco drop not null;
alter table public.cheques alter column titular drop not null;
alter table public.cheques alter column fecha_cobro drop not null;
alter table public.cheques add column if not exists foto_path text;

alter table public.envios drop constraint if exists envios_destinatario_id_fkey;
alter table public.envios add constraint envios_destinatario_id_fkey
  foreign key (destinatario_id) references public.destinatarios(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'destinatarios'
      and policyname = 'destinatarios_del'
  ) then
    create policy "destinatarios_del" on public.destinatarios
      for delete to authenticated using (public.es_autorizado());
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('cheques', 'cheques', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'cheques_fotos_sel'
  ) then
    create policy "cheques_fotos_sel" on storage.objects for select to authenticated
      using (bucket_id = 'cheques' and public.es_autorizado());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'cheques_fotos_ins'
  ) then
    create policy "cheques_fotos_ins" on storage.objects for insert to authenticated
      with check (bucket_id = 'cheques' and public.es_autorizado());
  end if;
end $$;
