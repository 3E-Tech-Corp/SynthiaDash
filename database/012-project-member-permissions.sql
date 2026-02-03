-- 012-project-member-permissions.sql
-- Add per-project permission overrides to ProjectMembers
-- NULL means "inherit from user's global setting"

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ProjectMembers') AND name = 'BugAccess')
BEGIN
    ALTER TABLE ProjectMembers ADD BugAccess NVARCHAR(20) NULL;
    PRINT 'Added BugAccess column to ProjectMembers';
END
ELSE
BEGIN
    PRINT 'BugAccess column already exists on ProjectMembers';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ProjectMembers') AND name = 'FeatureAccess')
BEGIN
    ALTER TABLE ProjectMembers ADD FeatureAccess NVARCHAR(20) NULL;
    PRINT 'Added FeatureAccess column to ProjectMembers';
END
ELSE
BEGIN
    PRINT 'FeatureAccess column already exists on ProjectMembers';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ProjectMembers') AND name = 'ChatAccess')
BEGIN
    ALTER TABLE ProjectMembers ADD ChatAccess NVARCHAR(50) NULL;
    PRINT 'Added ChatAccess column to ProjectMembers';
END
ELSE
BEGIN
    PRINT 'ChatAccess column already exists on ProjectMembers';
END
