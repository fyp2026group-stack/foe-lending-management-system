BEGIN;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('lab.lending_call_v4(text,text,text,jsonb)'::regprocedure) INTO definition;
 IF position('c.state=''AVAILABLE'' AND c.asset_id IS NULL AND c.quantity>0' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected source implementation';END IF;
 definition:=replace(definition,'c.state=''AVAILABLE'' AND c.asset_id IS NULL AND c.quantity>0','c.state=''AVAILABLE'' AND c.quantity>0');
 EXECUTE definition;
END $$;
COMMIT;
