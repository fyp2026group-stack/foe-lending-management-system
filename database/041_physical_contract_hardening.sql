BEGIN;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 -- Numeric status is reserved for the HTTP error envelope.
 definition:=replace(definition,'''status'',ins.status','''workflowStatus'',ins.status');
 definition:=replace(definition,'''status'',m.status','''workflowStatus'',m.status');
 definition:=replace(definition,'''status'',e.status','''workflowStatus'',e.status');
 definition:=replace(definition,'lim:=coalesce((p->>''limit'')::integer,50);',
 'IF op=''read_handover-assets'' AND EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN(''allocationId'',''limit'',''offset'')) OR op<>''read_handover-assets'' AND p ? ''allocationId'' THEN RAISE EXCEPTION ''INVALID'';END IF;
  lim:=coalesce((p->>''limit'')::integer,50);');
 definition:=replace(definition,'q:=coalesce((p->>''quantity'')::integer,1);',
 'IF p ? ''quantity'' AND (jsonb_typeof(p->''quantity'') IS DISTINCT FROM ''number'' OR (p->>''quantity'')!~''^[1-9][0-9]*$'') THEN RAISE EXCEPTION ''INVALID'';END IF;
  q:=coalesce((p->>''quantity'')::integer,1);');
 EXECUTE definition;
 -- Reusable identified stock is eligible for the borrower catalogue too.
 SELECT pg_get_functiondef('lab.lending_call_v3(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'c.state=''AVAILABLE'' AND c.asset_id IS NULL AND c.quantity>0','c.state=''AVAILABLE'' AND c.quantity>0');
 EXECUTE definition;
END $$;
COMMIT;
