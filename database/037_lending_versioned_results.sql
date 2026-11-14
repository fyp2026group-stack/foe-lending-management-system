BEGIN;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('lab.lend_submission_valid(jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'END LOOP;',
 ' IF EXISTS(SELECT 1 FROM lab.inv_items WHERE id=(v->>''itemId'')::uuid AND kind=''RETURNABLE'') AND (v->>''quantity'')::integer>20 THEN RETURN false;END IF;
 END LOOP;');
 EXECUTE definition;
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'RETURN result;'||chr(10)||' END IF;'||chr(10)||' INSERT INTO lab.lend_commands',
 'IF NOT result ? ''status'' AND old.command_id IS NULL AND op IN(''decisions'',''reserve'',''issues'') THEN
   SELECT * INTO l FROM lab.lend_lines WHERE id=l.id;
   result:=result||jsonb_build_object(''version'',l.version);
   UPDATE lab.lend_commands SET result=result WHERE false;
  END IF;
  RETURN result;'||chr(10)||' END IF;'||chr(10)||' INSERT INTO lab.lend_commands');
 -- Store exactly the public versioned result for subsequent command replay.
 definition:=replace(definition,'UPDATE lab.lend_commands SET result=result WHERE false;',
 'UPDATE lab.lend_commands c SET result=lending_call.result WHERE c.actor_id=actor AND c.command_id=cmd;');
 definition:=replace(definition,'result:=result||jsonb_build_object(''draftId'',d.id,''version'',d.version);',
 'result:=result||jsonb_build_object(''draftId'',d.id,''version'',d.version,''requestVersion'',(SELECT version FROM lab.lend_requests WHERE id=idvalue));');
 EXECUTE definition;
END $migration$;
COMMIT;
