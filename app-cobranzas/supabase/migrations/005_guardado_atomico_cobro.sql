create or replace function public.registrar_cobro(
  p_cliente_id uuid,
  p_monto numeric,
  p_forma_pago text,
  p_observaciones text,
  p_cheques jsonb,
  p_facturas jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cobro_id uuid;
  v_item jsonb;
begin
  if jsonb_typeof(coalesce(p_cheques, '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de cheques debe ser un arreglo';
  end if;
  if jsonb_typeof(coalesce(p_facturas, '[]'::jsonb)) <> 'array' then
    raise exception 'La lista de facturas debe ser un arreglo';
  end if;

  insert into public.cobros (cliente_id, monto, forma_pago, observaciones)
  values (p_cliente_id, p_monto, p_forma_pago, p_observaciones)
  returning id into v_cobro_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_cheques, '[]'::jsonb))
  loop
    insert into public.cheques (
      cobro_id, numero, banco, titular, fecha_cobro, monto, foto_path
    ) values (
      v_cobro_id,
      nullif(btrim(v_item->>'numero'), ''),
      nullif(btrim(v_item->>'banco'), ''),
      nullif(btrim(v_item->>'titular'), ''),
      nullif(v_item->>'fecha_cobro', '')::date,
      (v_item->>'monto')::numeric,
      nullif(v_item->>'foto_path', '')
    );
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_facturas, '[]'::jsonb))
  loop
    if nullif(btrim(v_item->>'numero_factura'), '') is null then
      raise exception 'El número de factura no puede estar vacío';
    end if;

    insert into public.cobro_factura (cobro_id, numero_factura, tipo)
    values (v_cobro_id, btrim(v_item->>'numero_factura'), v_item->>'tipo');
  end loop;

  return v_cobro_id;
end;
$$;

revoke all on function public.registrar_cobro(uuid, numeric, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_cobro(uuid, numeric, text, text, jsonb, jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'cheques_fotos_del'
  ) then
    create policy "cheques_fotos_del" on storage.objects for delete to authenticated
      using (bucket_id = 'cheques' and public.es_autorizado());
  end if;
end $$;
