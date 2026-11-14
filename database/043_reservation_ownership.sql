BEGIN;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 -- Anonymous cells are pooled. A positive shared cell is not evidence that
 -- this allocation owns anonymous units; subtract its live identified claims.
 definition:=replace(definition,'CASE WHEN c.quantity=0 THEN',
 'CASE WHEN a.quantity-a.issued-a.cancelled=(SELECT count(*) FROM lab.lend_reserved_assets ra WHERE ra.allocation_id=a.id AND NOT ra.released) THEN');
 definition:=replace(definition,'IF c.state=''AVAILABLE'' THEN',
 'IF c.state=''AVAILABLE'' THEN
     IF a.quantity-a.issued-a.cancelled<=(SELECT count(*) FROM lab.lend_reserved_assets ra WHERE ra.allocation_id=a.id AND NOT ra.released) THEN RAISE EXCEPTION ''STATE_CONFLICT'';END IF;');
 definition:=replace(definition,'v:=least(q,(SELECT quantity FROM lab.inv_cells WHERE id=a.cell_id));',
 'v:=least(q,a.quantity-a.issued-a.cancelled-(SELECT count(*)::integer FROM lab.lend_reserved_assets ra WHERE ra.allocation_id=a.id AND NOT ra.released));');
 EXECUTE definition;
 SELECT pg_get_functiondef('lab.lending_call_cp2(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF op=''reserve'' AND l.cancelled>0 AND old.command_id IS NULL THEN','IF op=''reserve'' AND old.command_id IS NULL THEN');
 EXECUTE definition;
END $$;
COMMIT;
