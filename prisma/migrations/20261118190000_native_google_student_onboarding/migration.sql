-- Only the columns needed for verified Google OIDC student onboarding.
-- The application validates OIDC independently of the database.
-- Native onboarding uses a restricted service account and never links a
-- preexisting account on email match alone.
GRANT SELECT (id,name,active) ON lab.batches TO lab_orm;
GRANT SELECT (google_subject,user_id,verified_email),
      INSERT (google_subject,user_id,verified_email)
  ON lab.google_student_identities TO lab_orm;
GRANT SELECT (id,email,display_name,password_hash,disabled,batch_id,registration_number),
      INSERT (id,email,display_name,password_hash,batch_id,registration_number)
  ON lab.users TO lab_orm;
GRANT SELECT (user_id,role), INSERT (user_id,role)
  ON lab.user_roles TO lab_orm;
GRANT INSERT (user_id,batch_id,changed_by)
  ON lab.user_batch_memberships TO lab_orm;
GRANT SELECT (user_id,index_number),
      INSERT (user_id,index_number,department,phone,google_email,university_email,personal_email)
  ON lab.student_profiles TO lab_orm;
GRANT INSERT (token_hash,user_id,csrf_hash,expires_at,revoked,last_seen_at)
  ON lab.sessions TO lab_orm;
GRANT INSERT (id,actor_id,action,target_id,details,occurred_at)
  ON lab.audit TO lab_orm;
