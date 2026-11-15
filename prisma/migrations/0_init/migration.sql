-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "lab";

-- CreateTable
CREATE TABLE "lab"."audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "details" JSONB,

    CONSTRAINT "audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."batches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."denial_suppression" (
    "singleton" BOOLEAN NOT NULL,
    "suppressed" BIGINT NOT NULL,
    "last_suppressed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "denial_suppression_pkey" PRIMARY KEY ("singleton")
);

-- CreateTable
CREATE TABLE "lab"."google_student_identities" (
    "google_subject" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "verified_email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "google_student_identities_pkey" PRIMARY KEY ("google_subject")
);

-- CreateTable
CREATE TABLE "lab"."inv_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proposer" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "approver" UUID,
    "movement_id" UUID,

    CONSTRAINT "inv_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "serial" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "inv_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inv_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_cells" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "asset_id" UUID,
    "state" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inv_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_commands" (
    "actor_id" UUID NOT NULL,
    "command_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB NOT NULL,

    CONSTRAINT "inv_commands_pkey" PRIMARY KEY ("actor_id","command_id")
);

-- CreateTable
CREATE TABLE "lab"."inv_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "movement_id" UUID NOT NULL,
    "cell_id" UUID,
    "account" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,

    CONSTRAINT "inv_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "rows" JSONB NOT NULL,
    "committed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inv_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "specifications" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "inv_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lab_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inv_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "inv_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."inv_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "provenance" TEXT NOT NULL,
    "movement_id" UUID NOT NULL,

    CONSTRAINT "inv_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."laboratories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_allocations" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "cell_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "issued" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lend_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_commands" (
    "actor_id" UUID NOT NULL,
    "command_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB NOT NULL,

    CONSTRAINT "lend_commands_pkey" PRIMARY KEY ("actor_id","command_id")
);

-- CreateTable
CREATE TABLE "lab"."lend_comments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "corrects_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_decisions" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_drafts" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "submitted_id" UUID,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "predecessor_id" UUID,

    CONSTRAINT "lend_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_extension_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "extension_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_extension_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_extensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loan_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "previous_due_at" TIMESTAMPTZ(6) NOT NULL,
    "proposed_due_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_handovers" (
    "loan_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "movement_id" UUID NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_handovers_pkey" PRIMARY KEY ("loan_id")
);

-- CreateTable
CREATE TABLE "lab"."lend_inspection_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inspection_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_inspection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_inspections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "return_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_lines" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "policy" TEXT NOT NULL,
    "lecturer_id" UUID,
    "hod_id" UUID,
    "stage" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lend_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_loans" (
    "id" UUID NOT NULL,
    "allocation_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "asset_id" UUID,
    "quantity" INTEGER NOT NULL,
    "returned" INTEGER NOT NULL DEFAULT 0,
    "issued_by" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "due_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "original_due_at" TIMESTAMPTZ(6),

    CONSTRAINT "lend_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_maintenance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inspection_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_maintenance_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "maintenance_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_maintenance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_policies" (
    "item_id" UUID NOT NULL,
    "policy" TEXT NOT NULL,
    "hod_id" UUID,

    CONSTRAINT "lend_policies_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "lab"."lend_requests" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "collect_at" TIMESTAMPTZ(6) NOT NULL,
    "return_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "predecessor_id" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "lend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."lend_reserved_assets" (
    "allocation_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "cell_id" UUID NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lend_reserved_assets_pkey" PRIMARY KEY ("allocation_id","asset_id")
);

-- CreateTable
CREATE TABLE "lab"."lend_returns" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "lend_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."login_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "credential_hash" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."login_limits" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "until_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "login_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "lab"."sessions" (
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "lab"."staff_labs" (
    "user_id" UUID NOT NULL,
    "laboratory_id" UUID NOT NULL,

    CONSTRAINT "staff_labs_pkey" PRIMARY KEY ("user_id","laboratory_id")
);

-- CreateTable
CREATE TABLE "lab"."student_profiles" (
    "user_id" UUID NOT NULL,
    "index_number" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "google_email" TEXT NOT NULL,
    "personal_email" TEXT,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "university_email" TEXT,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "lab"."user_batch_memberships" (
    "user_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
    "ended_at" TIMESTAMPTZ(6),
    "changed_by" UUID NOT NULL,

    CONSTRAINT "user_batch_memberships_pkey" PRIMARY KEY ("user_id","batch_id","started_at")
);

-- CreateTable
CREATE TABLE "lab"."user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "lab"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "batch_id" UUID,
    "registration_number" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab"."verifier_secret" (
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT NOT NULL,

    CONSTRAINT "verifier_secret_pkey" PRIMARY KEY ("singleton")
);

-- CreateIndex
CREATE UNIQUE INDEX "batches_name_key" ON "lab"."batches"("name");

-- CreateIndex
CREATE UNIQUE INDEX "google_student_identities_user_id_key" ON "lab"."google_student_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_assets_id_item_id_lab_id_key" ON "lab"."inv_assets"("id", "item_id", "lab_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_assets_item_id_serial_key" ON "lab"."inv_assets"("item_id", "serial");

-- CreateIndex
CREATE UNIQUE INDEX "inv_categories_name_key" ON "lab"."inv_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inv_one_active_asset" ON "lab"."inv_cells"("asset_id") WHERE ((asset_id IS NOT NULL) AND (quantity = 1));

-- CreateIndex
CREATE INDEX "inv_scope" ON "lab"."inv_cells"("lab_id", "item_id", "state", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_cells_item_id_lab_id_location_id_asset_id_state_key" ON "lab"."inv_cells"("item_id", "lab_id", "location_id", "asset_id", "state");

-- CreateIndex
CREATE INDEX "inv_entries_movement_id_idx" ON "lab"."inv_entries"("movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_locations_id_lab_id_key" ON "lab"."inv_locations"("id", "lab_id");

-- CreateIndex
CREATE UNIQUE INDEX "inv_locations_lab_id_name_key" ON "lab"."inv_locations"("lab_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "inv_receipts_item_id_lab_id_provenance_key" ON "lab"."inv_receipts"("item_id", "lab_id", "provenance");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_name_key" ON "lab"."laboratories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lend_allocations_line_id_key" ON "lab"."lend_allocations"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_comments_corrects_id_key" ON "lab"."lend_comments"("corrects_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_decisions_line_id_stage_key" ON "lab"."lend_decisions"("line_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "lend_drafts_submitted_id_key" ON "lab"."lend_drafts"("submitted_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_drafts_predecessor_id_key" ON "lab"."lend_drafts"("predecessor_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_extension_decisions_extension_id_key" ON "lab"."lend_extension_decisions"("extension_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_one_pending_extension" ON "lab"."lend_extensions"("loan_id") WHERE (status = 'PENDING'::text);

-- CreateIndex
CREATE UNIQUE INDEX "lend_handovers_movement_id_key" ON "lab"."lend_handovers"("movement_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_inspection_events_inspection_id_version_key" ON "lab"."lend_inspection_events"("inspection_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "lend_inspections_return_id_key" ON "lab"."lend_inspections"("return_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_loans_allocation_id_asset_id_key" ON "lab"."lend_loans"("allocation_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_maintenance_inspection_id_key" ON "lab"."lend_maintenance"("inspection_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_maintenance_events_maintenance_id_version_key" ON "lab"."lend_maintenance_events"("maintenance_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "lend_requests_predecessor_id_key" ON "lab"."lend_requests"("predecessor_id");

-- CreateIndex
CREATE UNIQUE INDEX "lend_reserved_identity" ON "lab"."lend_reserved_assets"("asset_id") WHERE (NOT released);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "lab"."sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_index_number_key" ON "lab"."student_profiles"("index_number");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_university_email_key" ON "lab"."student_profiles"("google_email");

-- CreateIndex
CREATE UNIQUE INDEX "user_batch_memberships_current" ON "lab"."user_batch_memberships"("user_id", "batch_id") WHERE (ended_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "lab"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_registration_number_key" ON "lab"."users"("registration_number");

-- AddForeignKey
ALTER TABLE "lab"."audit" ADD CONSTRAINT "audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."google_student_identities" ADD CONSTRAINT "google_student_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_adjustments" ADD CONSTRAINT "inv_adjustments_approver_fkey" FOREIGN KEY ("approver") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_adjustments" ADD CONSTRAINT "inv_adjustments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_adjustments" ADD CONSTRAINT "inv_adjustments_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_adjustments" ADD CONSTRAINT "inv_adjustments_location_id_lab_id_fkey" FOREIGN KEY ("location_id", "lab_id") REFERENCES "lab"."inv_locations"("id", "lab_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_adjustments" ADD CONSTRAINT "inv_adjustments_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "lab"."inv_movements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_adjustments" ADD CONSTRAINT "inv_adjustments_proposer_fkey" FOREIGN KEY ("proposer") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_assets" ADD CONSTRAINT "inv_assets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_assets" ADD CONSTRAINT "inv_assets_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_cells" ADD CONSTRAINT "inv_cells_asset_id_item_id_lab_id_fkey" FOREIGN KEY ("asset_id", "item_id", "lab_id") REFERENCES "lab"."inv_assets"("id", "item_id", "lab_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_cells" ADD CONSTRAINT "inv_cells_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_cells" ADD CONSTRAINT "inv_cells_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_cells" ADD CONSTRAINT "inv_cells_location_id_lab_id_fkey" FOREIGN KEY ("location_id", "lab_id") REFERENCES "lab"."inv_locations"("id", "lab_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_commands" ADD CONSTRAINT "inv_commands_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_entries" ADD CONSTRAINT "inv_entries_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "lab"."inv_cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_entries" ADD CONSTRAINT "inv_entries_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "lab"."inv_movements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_imports" ADD CONSTRAINT "inv_imports_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_items" ADD CONSTRAINT "inv_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "lab"."inv_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_locations" ADD CONSTRAINT "inv_locations_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_movements" ADD CONSTRAINT "inv_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_movements" ADD CONSTRAINT "inv_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_movements" ADD CONSTRAINT "inv_movements_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_receipts" ADD CONSTRAINT "inv_receipts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_receipts" ADD CONSTRAINT "inv_receipts_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."inv_receipts" ADD CONSTRAINT "inv_receipts_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "lab"."inv_movements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_allocations" ADD CONSTRAINT "lend_allocations_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "lab"."inv_cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_allocations" ADD CONSTRAINT "lend_allocations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lab"."lend_lines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_commands" ADD CONSTRAINT "lend_commands_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_comments" ADD CONSTRAINT "lend_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_comments" ADD CONSTRAINT "lend_comments_corrects_id_fkey" FOREIGN KEY ("corrects_id") REFERENCES "lab"."lend_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_comments" ADD CONSTRAINT "lend_comments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "lab"."lend_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_decisions" ADD CONSTRAINT "lend_decisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_decisions" ADD CONSTRAINT "lend_decisions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "lab"."lend_lines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_drafts" ADD CONSTRAINT "lend_drafts_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_drafts" ADD CONSTRAINT "lend_drafts_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "lab"."lend_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_drafts" ADD CONSTRAINT "lend_drafts_submitted_id_fkey" FOREIGN KEY ("submitted_id") REFERENCES "lab"."lend_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_extension_decisions" ADD CONSTRAINT "lend_extension_decisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_extension_decisions" ADD CONSTRAINT "lend_extension_decisions_extension_id_fkey" FOREIGN KEY ("extension_id") REFERENCES "lab"."lend_extensions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_extensions" ADD CONSTRAINT "lend_extensions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "lab"."lend_loans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_extensions" ADD CONSTRAINT "lend_extensions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_handovers" ADD CONSTRAINT "lend_handovers_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_handovers" ADD CONSTRAINT "lend_handovers_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "lab"."lend_loans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_handovers" ADD CONSTRAINT "lend_handovers_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "lab"."inv_movements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_inspection_events" ADD CONSTRAINT "lend_inspection_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_inspection_events" ADD CONSTRAINT "lend_inspection_events_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "lab"."lend_inspections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_inspections" ADD CONSTRAINT "lend_inspections_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "lab"."inv_assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_inspections" ADD CONSTRAINT "lend_inspections_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_inspections" ADD CONSTRAINT "lend_inspections_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "lab"."lend_returns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_lines" ADD CONSTRAINT "lend_lines_hod_id_fkey" FOREIGN KEY ("hod_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_lines" ADD CONSTRAINT "lend_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_lines" ADD CONSTRAINT "lend_lines_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_lines" ADD CONSTRAINT "lend_lines_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_lines" ADD CONSTRAINT "lend_lines_location_id_lab_id_fkey" FOREIGN KEY ("location_id", "lab_id") REFERENCES "lab"."inv_locations"("id", "lab_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_lines" ADD CONSTRAINT "lend_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "lab"."lend_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_loans" ADD CONSTRAINT "lend_loans_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "lab"."lend_allocations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_loans" ADD CONSTRAINT "lend_loans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "lab"."inv_assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_loans" ADD CONSTRAINT "lend_loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_loans" ADD CONSTRAINT "lend_loans_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_maintenance" ADD CONSTRAINT "lend_maintenance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_maintenance" ADD CONSTRAINT "lend_maintenance_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "lab"."lend_inspections"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_maintenance_events" ADD CONSTRAINT "lend_maintenance_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_maintenance_events" ADD CONSTRAINT "lend_maintenance_events_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "lab"."lend_maintenance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_policies" ADD CONSTRAINT "lend_policies_hod_id_fkey" FOREIGN KEY ("hod_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_policies" ADD CONSTRAINT "lend_policies_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "lab"."inv_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_requests" ADD CONSTRAINT "lend_requests_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_requests" ADD CONSTRAINT "lend_requests_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "lab"."lend_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_reserved_assets" ADD CONSTRAINT "lend_reserved_assets_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "lab"."lend_allocations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_reserved_assets" ADD CONSTRAINT "lend_reserved_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "lab"."inv_assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_reserved_assets" ADD CONSTRAINT "lend_reserved_assets_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "lab"."inv_cells"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_returns" ADD CONSTRAINT "lend_returns_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."lend_returns" ADD CONSTRAINT "lend_returns_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "lab"."lend_loans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."login_challenges" ADD CONSTRAINT "login_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."staff_labs" ADD CONSTRAINT "staff_labs_laboratory_id_fkey" FOREIGN KEY ("laboratory_id") REFERENCES "lab"."laboratories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."staff_labs" ADD CONSTRAINT "staff_labs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."user_batch_memberships" ADD CONSTRAINT "user_batch_memberships_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "lab"."batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."user_batch_memberships" ADD CONSTRAINT "user_batch_memberships_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."user_batch_memberships" ADD CONSTRAINT "user_batch_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lab"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lab"."users" ADD CONSTRAINT "users_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "lab"."batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

