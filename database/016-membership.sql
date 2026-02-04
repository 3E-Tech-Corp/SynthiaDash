-- 016-membership.sql: Add membership fields to Users table

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MembershipType')
    ALTER TABLE Users ADD MembershipType NVARCHAR(20) NOT NULL DEFAULT 'free';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PhoneNumber')
    ALTER TABLE Users ADD PhoneNumber NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'EmailVerified')
    ALTER TABLE Users ADD EmailVerified BIT NOT NULL DEFAULT 0;

-- Set existing users to 'developer' membership (they were manually added)
UPDATE Users SET MembershipType = 'developer' WHERE MembershipType = 'free' AND Role IN ('admin', 'viewer');
