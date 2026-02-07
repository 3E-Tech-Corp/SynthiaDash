-- Add FullChatAccess column to Users
-- This grants access to direct chat with Synthia (Clawdbot) without project scoping

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FullChatAccess')
BEGIN
    ALTER TABLE Users ADD FullChatAccess BIT NOT NULL DEFAULT 0;
    PRINT 'Added FullChatAccess column to Users';
END
GO

-- Grant access to admin users by default
UPDATE Users SET FullChatAccess = 1 WHERE Role = 'admin';
GO
