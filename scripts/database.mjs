import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url = process.env.MIGRATION_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
  throw Error('Local migration database URL required');
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  if (process.argv[2] === 'migrate') {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(731942)');
    await c.query(
      'CREATE TABLE IF NOT EXISTS public.lab_migrations(name text PRIMARY KEY,digest text NOT NULL)'
    );
    for (const name of [
      '001_identity.sql',
      '002_runtime_grants.sql',
      '003_integrity.sql',
      '004_audit_details.sql',
      '005_protected_identity.sql',
      '006_denial_audit.sql',
      '007_deferred_profile_owner.sql',
      '008_admission_and_observability.sql',
      '009_unknown_admission_order.sql',
      '010_inventory.sql',
      '011_inventory_api.sql',
      '012_import_admission.sql',
      '013_inventory_scope.sql',
      '014_inventory_integrity.sql',
      '015_asset_history.sql',
      '016_import_duplicate_preview.sql',
      '017_inventory_activity.sql',
      '018_preview_validation.sql',
      '019_inventory_dtos.sql',
      '020_preview_all_rows.sql',
      '021_preview_shape_guard.sql',
      '022_inventory_contract_security.sql',
      '023_basic_lending.sql',
      '024_lending_authorization_order.sql',
      '025_lending_function_ownership.sql',
      '026_lending_history_privilege.sql',
      '027_application_lending.sql',
      '028_lending_sources.sql',
      '029_lending_source_replay.sql',
      '030_lending_current_authority.sql',
      '031_catalogue_evolution.sql',
      '032_catalogue_reference_guards.sql',
      '033_catalogue_concurrent_admission.sql',
      '034_catalogue_lending_lock_order.sql',
      '035_lending_lifecycle.sql',
      '036_lending_lifecycle_hardening.sql',
      '037_lending_versioned_results.sql',
      '038_lending_cancellation_summary.sql',
      '039_physical_lifecycle.sql',
      '040_identified_reservations.sql',
      '041_physical_contract_hardening.sql',
      '042_physical_query_resolution.sql',
      '043_reservation_ownership.sql',
      '044_identified_source_eligibility.sql',
      '045_legacy_receipt_backfill.sql',
      '046_officer_operational_contract.sql',
      '047_hod_admin_reporting.sql',
      '048_hod_admin_governance.sql',
      '049_hod_admin_reporting_hardening.sql',
      '050_hod_admin_governance_hardening.sql',
      '051_hod_admin_self_change_guard.sql',
      '052_google_student_registration.sql',
      '053_google_student_identity_uniqueness.sql',
    ]) {
      const source = await readFile(new URL('../database/' + name, import.meta.url), 'utf8');
      const digest = createHash('sha256').update(source).digest('hex');
      const old = (await c.query('SELECT digest FROM public.lab_migrations WHERE name=$1', [name]))
        .rows[0];
      if (old) {
        if (old.digest !== digest) throw Error('Applied migration changed');
        continue;
      }
      await c.query(source.replace(/^BEGIN;\s*|^COMMIT;\s*/gm, ''));
      await c.query('INSERT INTO public.lab_migrations VALUES($1,$2)', [name, digest]);
    }
    await c.query('COMMIT');
  } else throw Error('Only schema migration is supported; seeding will be added later');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  await c.end();
}
