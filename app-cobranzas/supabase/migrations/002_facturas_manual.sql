-- Las facturas ya no se cargan como tabla: en cada cobro se anotan a mano los números
-- de factura que abona o que quedan con pago parcial.
drop view if exists facturas_saldo;
alter table cobro_factura drop column if exists factura_id;
alter table cobro_factura add column if not exists numero_factura text;
update cobro_factura set numero_factura = '' where numero_factura is null;
alter table cobro_factura alter column numero_factura set not null;
alter table cobro_factura alter column numero_factura drop default;
alter table cobro_factura add column if not exists tipo text not null default 'pagada'
  check (tipo in ('pagada','parcial'));
alter table cobro_factura alter column monto_aplicado drop not null;
drop table if exists facturas;
