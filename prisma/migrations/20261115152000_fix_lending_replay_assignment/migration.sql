-- Fix the actual command-replay write in the legacy lending function.
-- PL/pgSQL variables must not be referenced through an implicit function
-- qualifier in an UPDATE whose target table also has column "result".
-- Qualifier repairs alone still produce SQLSTATE 42P01 after function renames.
--
-- EXECUTE ... USING binds result/actor/cmd as typed parameters. This retains
-- the identical WHERE condition, updates only the current command result,
-- and cannot inject SQL via user-supplied data.
DO $migration$
DECLARE
  definition text;
  previous_statement text :=
    'UPDATE lab.lend_commands c SET result=lending_call_cp2.result WHERE c.actor_id=actor AND c.command_id=cmd;';
  repaired_statement text :=
    'EXECUTE ''UPDATE lab.lend_commands c SET result=$1 WHERE c.actor_id=$2 AND c.command_id=$3'' USING result,actor,cmd;';
BEGIN
  -- Fresh Prisma-only schemas have no legacy business RPC to patch.
  IF to_regprocedure('lab.lending_call_cp2(text,text,text,jsonb)') IS NULL THEN RETURN; END IF;
  SELECT pg_get_functiondef('lab.lending_call_cp2(text,text,text,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL OR position(previous_statement IN definition)=0 THEN
    RAISE EXCEPTION 'Expected lending replay assignment absent; refusing unsafe migration';
  END IF;
  definition := replace(definition,previous_statement,repaired_statement);
  EXECUTE definition;
END
$migration$;
