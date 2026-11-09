# Local PostgreSQL evidence

Executed cached postgres:15-alpine with Docker project lab-m2-identity, container lab-m2-identity-postgres-1, host loopback55439, database lab_m2_test_identity. No image download, host settings or existing containers modified. Docker pipe access required approved escalation.

Ignored generated configuration: C:\Projects\LabInventorySystem\.verification\m2.env. Contains runtime/migration URLs, synthetic seed password and QA M2_TEST_* variables; never log or commit it. Load using Node --env-file. App origin127.0.0.1:3000; no app started by Backend. QA may start isolated app with this configuration when coordinated by Orbit. Container left running for authorized QA.

Provision-runtime, migrate, seed succeeded. Subsequent migrate twice and seed twice completed with exit0. Runtime verification using actual lab_runtime: five fixture users, all four distinct roles; CREATE in lab and audit DELETE/UPDATE/TRUNCATE rejected42501. No HTTP, concurrent revocation or injected audit-failure acceptance claimed. Migration bootstrap is container superuser; runtime is not. Further privilege hardening required.

Source additions: streaming16KiB body cap; async scrypt at most2 active jobs/no unbounded queue; explicit PATCH lab replacement; separate post-rollback sanitized governance denial record; before/after roles/labs/disabled success audit. Hash work still occurs while transaction locks held but concurrency/memory bounded. Audit sink outage logs fixed minimal diagnostic and never executes denied command.

SEC02 remains acceptance-blocking: runtime can directly alter identity/session/governance tables and INSERT arbitrary audit facts, bypassing application role/actor validation. No token-derived narrow protected-function API implemented yet. Governance denial recording validates opaque session but direct DML makes it insufficient against compromised runtime. Independent Security assessment required; no production/SEC closure.
