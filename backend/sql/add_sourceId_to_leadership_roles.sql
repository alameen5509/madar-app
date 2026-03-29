-- إضافة عمود SourceId لربط المناصب بالوظائف والأعمال تلقائياً
ALTER TABLE LeadershipRoles ADD COLUMN IF NOT EXISTS SourceId VARCHAR(36) NULL;
CREATE INDEX IF NOT EXISTS idx_leadership_roles_source ON LeadershipRoles(SourceId);
