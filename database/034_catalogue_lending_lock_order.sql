-- Acquire the inventory gate before lending takes any stock-cell row locks.
-- This prevents a row-lock/gate inversion with simultaneous inventory writes.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'BEGIN'||chr(10),'BEGIN'||chr(10)||
 ' PERFORM pg_advisory_xact_lock_shared(731942);'||chr(10)||
 ' IF op NOT LIKE ''read_%'' THEN PERFORM pg_advisory_xact_lock(731943);END IF;'||chr(10));
 -- Source migrations can use CRLF; normalize before applying the insertion.
 IF position('pg_advisory_xact_lock(731943)' IN definition)=0 THEN
 definition:=replace(definition,'BEGIN'||chr(13)||chr(10),'BEGIN'||chr(10)||
 ' PERFORM pg_advisory_xact_lock_shared(731942);'||chr(10)||
 ' IF op NOT LIKE ''read_%'' THEN PERFORM pg_advisory_xact_lock(731943);END IF;'||chr(10));
 END IF;
 EXECUTE definition;
END $migration$;
