-- 014-notification-settings-taskid.sql
-- Add TaskId column (authoritative) alongside TaskCode (display only)

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NotificationSettings') AND name = 'TaskId')
BEGIN
    ALTER TABLE NotificationSettings ADD TaskId INT NULL;
    PRINT 'Added TaskId column to NotificationSettings';
END
GO
