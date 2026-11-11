-- STOCK REAL del Drop 001. Pegar en Supabase → SQL Editor → Run.
-- Una fila por producto / color / talle. Los nombres de color y los talles tienen que coincidir EXACTO con data/products.ts.
-- Se puede correr de nuevo para corregir cantidades (pisa lo que haya).
-- ⚠ Si ya hay ventas, correrlo vuelve a poner estas cantidades y "devuelve" lo vendido: para ajustar con el drop abierto, usar update puntual.

insert into stock (slug, color, size, qty) values
  -- producto-01 · Byslf patch negra (remera)
  ('producto-01', 'Negro',     'S',  6),
  ('producto-01', 'Negro',     'M', 16),
  ('producto-01', 'Negro',     'L',  8),
  -- producto-02 · Byslf patch gris topo (remera)
  ('producto-02', 'Gris topo', 'S',  6),
  ('producto-02', 'Gris topo', 'M', 16),
  ('producto-02', 'Gris topo', 'L',  8),
  -- producto-03 · Bermuda ID negra
  ('producto-03', 'Negro',     'S',  7),
  ('producto-03', 'Negro',     'M', 15),
  ('producto-03', 'Negro',     'L',  8)
on conflict (slug, color, size) do update set qty = excluded.qty;

-- Para sacar el stock de PRUEBA (producto-01 con 3 unidades) no hace falta borrar nada: este script lo pisa.
-- Verificar:
-- select slug, color, size, qty from stock order by slug, color, size;
-- Total esperado: 6+16+8 + 6+16+8 + 7+15+8 = 90 unidades.
