-- Tipos de gestión: depósito, gestión, retiro/entrega de documentación y otros (con descripción)
alter table gestiones drop constraint if exists gestiones_tipo_check;
update gestiones set tipo = 'otros' where tipo not in ('deposito','gestion','retiro_documentacion','entrega_documentacion','otros');
alter table gestiones add constraint gestiones_tipo_check
  check (tipo in ('deposito','gestion','retiro_documentacion','entrega_documentacion','otros'));
alter table gestiones add constraint gestiones_otros_desc
  check (tipo <> 'otros' or length(trim(coalesce(observaciones, ''))) > 0);
