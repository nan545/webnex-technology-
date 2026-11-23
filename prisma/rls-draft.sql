-- INCOMPLETE DRAFT: Do not deploy. Policy and application integration need
-- further security review and end-to-end testing.
-- Row-level security.
--
-- The application sets transaction-local settings before every query that is
-- made on behalf of an identified actor (see src/server/db.ts):
--   app.actor            anonymous (default) | auth | intake | admin | system
--   app.user_id          administrator id when actor = admin
--   app.permissions      comma-separated permission keys when actor = admin
--   app.idempotency_key  enquiry idempotency key when actor = intake
-- With no settings every query is anonymous, which can only read published
-- public content. Tables are FORCEd so the owning database role is also bound.

CREATE FUNCTION app_actor() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.actor', true), ''), 'anonymous')
$$;

CREATE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION app_idempotency_key() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.idempotency_key', true), '')::uuid
$$;

CREATE FUNCTION app_is_system() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT app_actor() = 'system' $$;

CREATE FUNCTION app_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT app_actor() = 'admin' $$;

CREATE FUNCTION app_has_permission(VARIADIC required text[]) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_actor() = 'admin' AND EXISTS (
    SELECT 1
    FROM unnest(string_to_array(COALESCE(current_setting('app.permissions', true), ''), ',')) AS held(key)
    WHERE held.key = ANY (required)
  )
$$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PageRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRedirect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Industry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseStudy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Testimonial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPostCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPostTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnquiryActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowUpTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnquiryNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NavigationItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Permission" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Page" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PageRevision" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRevision" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRedirect" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Industry" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProjectService" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CaseStudy" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Testimonial" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BlogPost" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BlogPostCategory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Tag" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BlogPostTag" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Enquiry" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EnquiryActivity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FollowUpTask" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Proposal" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EnquiryNote" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting" FORCE ROW LEVEL SECURITY;
ALTER TABLE "NotificationOutbox" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" FORCE ROW LEVEL SECURITY;
ALTER TABLE "NavigationItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

-- Identity and access. Credentials are only reachable by the sign-in flow
-- (auth), administrators and the system.
CREATE POLICY user_select ON "User" FOR SELECT USING (app_actor() IN ('system', 'auth', 'admin'));
CREATE POLICY user_insert ON "User" FOR INSERT WITH CHECK (app_is_system() OR app_has_permission('users:manage'));
CREATE POLICY user_update ON "User" FOR UPDATE
  USING (app_actor() IN ('system', 'auth') OR app_has_permission('users:manage', 'roles:manage'));
CREATE POLICY user_delete ON "User" FOR DELETE USING (app_is_system() OR app_has_permission('users:manage'));

CREATE POLICY role_select ON "Role" FOR SELECT USING (app_actor() IN ('system', 'auth', 'admin'));
CREATE POLICY role_write ON "Role" FOR ALL
  USING (app_is_system() OR app_has_permission('roles:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('roles:manage'));

CREATE POLICY permission_select ON "Permission" FOR SELECT USING (app_actor() IN ('system', 'auth', 'admin'));
CREATE POLICY permission_write ON "Permission" FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());

CREATE POLICY user_role_select ON "UserRole" FOR SELECT USING (app_actor() IN ('system', 'auth', 'admin'));
CREATE POLICY user_role_write ON "UserRole" FOR ALL
  USING (app_is_system() OR app_has_permission('users:manage', 'roles:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('users:manage', 'roles:manage'));

CREATE POLICY role_permission_select ON "RolePermission" FOR SELECT USING (app_actor() IN ('system', 'auth', 'admin'));
CREATE POLICY role_permission_write ON "RolePermission" FOR ALL
  USING (app_is_system() OR app_has_permission('roles:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('roles:manage'));

-- Unused by the JWT session strategy; reachable only by the system.
CREATE POLICY account_system ON "Account" FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());
CREATE POLICY session_system ON "Session" FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());
CREATE POLICY verification_token_system ON "VerificationToken" FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());

-- CMS content.
CREATE POLICY page_select ON "Page" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('content:read', 'content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore', 'services:manage'));
CREATE POLICY page_write ON "Page" FOR ALL
  USING (app_is_system() OR app_has_permission('content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore'))
  WITH CHECK (app_is_system() OR app_has_permission('content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore'));
CREATE POLICY page_revision_select ON "PageRevision" FOR SELECT
  USING (app_is_system() OR app_has_permission('content:read', 'content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore'));
CREATE POLICY page_revision_write ON "PageRevision" FOR ALL
  USING (app_is_system() OR app_has_permission('content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore'))
  WITH CHECK (app_is_system() OR app_has_permission('content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore'));

CREATE POLICY service_select ON "Service" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('content:read', 'content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore', 'services:manage'));
CREATE POLICY service_insert ON "Service" FOR INSERT
  WITH CHECK (app_is_system() OR app_has_permission('content:write', 'services:manage'));
CREATE POLICY service_update ON "Service" FOR UPDATE
  USING (app_is_system() OR app_has_permission('content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore', 'services:manage'));
CREATE POLICY service_delete ON "Service" FOR DELETE
  USING (app_is_system() OR app_has_permission('services:manage'));

CREATE POLICY service_revision_select ON "ServiceRevision" FOR SELECT
  USING (app_is_system() OR app_has_permission('content:read', 'content:write', 'content:review', 'content:approve', 'content:publish', 'content:restore', 'services:manage'));
CREATE POLICY service_revision_insert ON "ServiceRevision" FOR INSERT
  WITH CHECK (app_is_system() OR app_has_permission('content:write', 'content:publish', 'content:restore', 'services:manage'));
CREATE POLICY service_revision_delete ON "ServiceRevision" FOR DELETE
  USING (app_is_system() OR app_has_permission('services:manage'));

CREATE POLICY service_redirect_select ON "ServiceRedirect" FOR SELECT USING (true);
CREATE POLICY service_redirect_write ON "ServiceRedirect" FOR ALL
  USING (app_is_system() OR app_has_permission('content:write', 'content:publish', 'services:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('content:write', 'content:publish', 'services:manage'));

-- Projects, blog and other publications.
CREATE POLICY project_select ON "Project" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('projects:manage', 'content:read'));
CREATE POLICY project_write ON "Project" FOR ALL
  USING (app_is_system() OR app_has_permission('projects:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('projects:manage'));

CREATE POLICY blog_post_select ON "BlogPost" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('blog:manage', 'content:read'));
CREATE POLICY blog_post_write ON "BlogPost" FOR ALL
  USING (app_is_system() OR app_has_permission('blog:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('blog:manage'));

CREATE POLICY industry_select ON "Industry" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('industries:manage', 'content:read'));
CREATE POLICY industry_write ON "Industry" FOR ALL
  USING (app_is_system() OR app_has_permission('industries:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('industries:manage'));

CREATE POLICY case_study_select ON "CaseStudy" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('case-studies:manage', 'content:read'));
CREATE POLICY case_study_write ON "CaseStudy" FOR ALL
  USING (app_is_system() OR app_has_permission('case-studies:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('case-studies:manage'));

CREATE POLICY testimonial_select ON "Testimonial" FOR SELECT
  USING (app_is_system() OR status = 'PUBLISHED' OR app_has_permission('testimonials:manage', 'content:read'));
CREATE POLICY testimonial_write ON "Testimonial" FOR ALL
  USING (app_is_system() OR app_has_permission('testimonials:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('testimonials:manage'));

-- Link rows inherit visibility from the rows they join (subqueries are
-- evaluated with the same policies).
CREATE POLICY project_service_select ON "ProjectService" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "projectId"));
CREATE POLICY project_service_write ON "ProjectService" FOR ALL
  USING (app_is_system() OR app_has_permission('projects:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('projects:manage'));

CREATE POLICY blog_post_category_select ON "BlogPostCategory" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "BlogPost" b WHERE b.id = "blogPostId"));
CREATE POLICY blog_post_category_write ON "BlogPostCategory" FOR ALL
  USING (app_is_system() OR app_has_permission('blog:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('blog:manage'));
CREATE POLICY blog_post_tag_select ON "BlogPostTag" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "BlogPost" b WHERE b.id = "blogPostId"));
CREATE POLICY blog_post_tag_write ON "BlogPostTag" FOR ALL
  USING (app_is_system() OR app_has_permission('blog:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('blog:manage'));

CREATE POLICY category_select ON "Category" FOR SELECT USING (true);
CREATE POLICY category_write ON "Category" FOR ALL
  USING (app_is_system() OR app_has_permission('blog:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('blog:manage'));
CREATE POLICY tag_select ON "Tag" FOR SELECT USING (true);
CREATE POLICY tag_write ON "Tag" FOR ALL
  USING (app_is_system() OR app_has_permission('blog:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('blog:manage'));

-- Team profiles: only published, active profiles are public.
CREATE POLICY team_member_select ON "TeamMember" FOR SELECT
  USING (app_is_system() OR (status = 'PUBLISHED' AND "isActive") OR app_has_permission('team:view', 'team:manage'));
CREATE POLICY team_member_insert ON "TeamMember" FOR INSERT
  WITH CHECK (app_is_system() OR app_has_permission('team:create', 'team:manage'));
CREATE POLICY team_member_update ON "TeamMember" FOR UPDATE
  USING (app_is_system() OR app_has_permission('team:update', 'team:publish', 'team:manage_media', 'team:manage', 'content:approve'));
CREATE POLICY team_member_delete ON "TeamMember" FOR DELETE
  USING (app_is_system() OR app_has_permission('team:delete', 'team:manage'));

-- Uploaded files are public only while a record that the actor can see uses them.
CREATE POLICY media_asset_select ON "MediaAsset" FOR SELECT
  USING (
    app_is_system()
    OR app_has_permission('media:manage', 'team:view', 'team:manage', 'projects:manage', 'blog:manage')
    OR EXISTS (SELECT 1 FROM "TeamMember" t WHERE t."profileImageId" = "MediaAsset".id)
    OR EXISTS (SELECT 1 FROM "Project" p WHERE p."coverImageId" = "MediaAsset".id)
    OR EXISTS (SELECT 1 FROM "BlogPost" b WHERE b."coverImageId" = "MediaAsset".id)
  );
CREATE POLICY media_asset_write ON "MediaAsset" FOR ALL
  USING (app_is_system() OR app_has_permission('media:manage', 'team:manage_media', 'team:manage', 'projects:manage', 'blog:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('media:manage', 'team:manage_media', 'team:manage', 'projects:manage', 'blog:manage'));

-- Enquiries. The public form (intake) can create one enquiry and read back
-- only the enquiry that carries its own idempotency key.
CREATE POLICY enquiry_select ON "Enquiry" FOR SELECT
  USING (
    app_is_system()
    OR app_has_permission('enquiries:read', 'enquiries:update', 'proposals:manage')
    OR (app_actor() = 'intake' AND "idempotencyKey" IS NOT NULL AND "idempotencyKey" = app_idempotency_key())
  );
CREATE POLICY enquiry_insert ON "Enquiry" FOR INSERT
  WITH CHECK (
    app_is_system()
    OR (
      app_actor() = 'intake'
      AND status = 'NEW'
      AND "assignedToId" IS NULL
      AND "idempotencyKey" IS NOT NULL
      AND "idempotencyKey" = app_idempotency_key()
    )
  );
CREATE POLICY enquiry_update ON "Enquiry" FOR UPDATE
  USING (app_is_system() OR app_has_permission('enquiries:update', 'proposals:manage'));
CREATE POLICY enquiry_delete ON "Enquiry" FOR DELETE USING (app_is_system());

CREATE POLICY enquiry_activity_select ON "EnquiryActivity" FOR SELECT
  USING (
    app_is_system()
    OR app_has_permission('enquiries:read', 'enquiries:update')
    OR (app_actor() = 'intake' AND EXISTS (SELECT 1 FROM "Enquiry" e WHERE e.id = "enquiryId"))
  );
CREATE POLICY enquiry_activity_insert ON "EnquiryActivity" FOR INSERT
  WITH CHECK (
    app_is_system()
    OR app_has_permission('enquiries:update', 'proposals:manage')
    OR (
      app_actor() = 'intake'
      AND type = 'ENQUIRY_RECEIVED'
      AND EXISTS (SELECT 1 FROM "Enquiry" e WHERE e.id = "enquiryId")
    )
  );

CREATE POLICY enquiry_note_select ON "EnquiryNote" FOR SELECT
  USING (app_is_system() OR app_has_permission('enquiries:read', 'enquiries:update'));
CREATE POLICY enquiry_note_insert ON "EnquiryNote" FOR INSERT
  WITH CHECK (app_is_system() OR app_has_permission('enquiries:update'));

CREATE POLICY follow_up_task_select ON "FollowUpTask" FOR SELECT
  USING (app_is_system() OR app_has_permission('enquiries:read', 'enquiries:update'));
CREATE POLICY follow_up_task_write ON "FollowUpTask" FOR ALL
  USING (app_is_system() OR app_has_permission('enquiries:update'))
  WITH CHECK (app_is_system() OR app_has_permission('enquiries:update'));

CREATE POLICY proposal_select ON "Proposal" FOR SELECT
  USING (app_is_system() OR app_has_permission('enquiries:read', 'proposals:manage'));
CREATE POLICY proposal_write ON "Proposal" FOR ALL
  USING (app_is_system() OR app_has_permission('proposals:manage'))
  WITH CHECK (app_is_system() OR app_has_permission('proposals:manage'));

-- Settings, navigation and notifications.
CREATE POLICY site_setting_select ON "SiteSetting" FOR SELECT
  USING ("isPublic" OR app_is_system() OR app_has_permission('settings:manage', 'content:publish'));
CREATE POLICY site_setting_write ON "SiteSetting" FOR ALL
  USING (app_is_system() OR app_has_permission('settings:manage', 'content:publish'))
  WITH CHECK (app_is_system() OR app_has_permission('settings:manage', 'content:publish'));

CREATE POLICY navigation_item_select ON "NavigationItem" FOR SELECT
  USING ("isVisible" OR app_is_system() OR app_has_permission('settings:manage', 'content:publish'));
CREATE POLICY navigation_item_write ON "NavigationItem" FOR ALL
  USING (app_is_system() OR app_has_permission('settings:manage', 'content:publish'))
  WITH CHECK (app_is_system() OR app_has_permission('settings:manage', 'content:publish'));

CREATE POLICY notification_outbox_select ON "NotificationOutbox" FOR SELECT
  USING (
    app_is_system()
    OR app_has_permission('settings:manage')
    OR (app_actor() = 'intake' AND EXISTS (SELECT 1 FROM "Enquiry" e WHERE e.id = "enquiryId"))
  );
CREATE POLICY notification_outbox_insert ON "NotificationOutbox" FOR INSERT
  WITH CHECK (
    app_is_system()
    OR (
      app_actor() = 'intake'
      AND status = 'PENDING'
      AND event IN ('ENQUIRY_RECEIVED', 'ENQUIRY_ACKNOWLEDGEMENT')
      AND EXISTS (SELECT 1 FROM "Enquiry" e WHERE e.id = "enquiryId")
    )
  );
CREATE POLICY notification_outbox_update ON "NotificationOutbox" FOR UPDATE
  USING (app_is_system() OR app_has_permission('settings:manage'));
CREATE POLICY notification_outbox_delete ON "NotificationOutbox" FOR DELETE USING (app_is_system());

CREATE POLICY rate_limit_bucket_access ON "RateLimitBucket" FOR ALL
  USING (app_actor() IN ('system', 'auth', 'intake'))
  WITH CHECK (app_actor() IN ('system', 'auth', 'intake'));

-- The audit trail is append-only: no actor may update or delete entries, and
-- administrators can only record entries under their own identity.
CREATE POLICY audit_log_select ON "AuditLog" FOR SELECT
  USING (app_is_system() OR app_has_permission('audit:read'));
CREATE POLICY audit_log_insert ON "AuditLog" FOR INSERT
  WITH CHECK (
    app_actor() IN ('system', 'auth')
    OR (app_is_admin() AND "actorId" = app_user_id())
  );
