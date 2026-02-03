-- 013-notification-settings.sql
-- FXNotification event-to-task mapping table
-- Maps app-level event codes to FXNotification TaskCodes

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationSettings')
BEGIN
    CREATE TABLE NotificationSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        EventCode NVARCHAR(100) NOT NULL,
        EventName NVARCHAR(200) NOT NULL,
        TaskCode NVARCHAR(100) NULL,
        IsEnabled BIT NOT NULL DEFAULT 1,
        Description NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_NotificationSettings_EventCode UNIQUE (EventCode)
    );

    CREATE INDEX IX_NotificationSettings_EventCode ON NotificationSettings(EventCode);

    PRINT 'Created NotificationSettings table';
END
GO

-- Seed default event codes for SynthiaDash
IF NOT EXISTS (SELECT 1 FROM NotificationSettings WHERE EventCode = 'TICKET_CREATED')
    INSERT INTO NotificationSettings (EventCode, EventName, Description)
    VALUES ('TICKET_CREATED', 'Ticket Created', 'Sent when a new ticket (bug or feature) is submitted');

IF NOT EXISTS (SELECT 1 FROM NotificationSettings WHERE EventCode = 'TICKET_COMPLETED')
    INSERT INTO NotificationSettings (EventCode, EventName, Description)
    VALUES ('TICKET_COMPLETED', 'Ticket Completed', 'Sent when a ticket is marked as completed');

IF NOT EXISTS (SELECT 1 FROM NotificationSettings WHERE EventCode = 'DEMO_REQUEST')
    INSERT INTO NotificationSettings (EventCode, EventName, Description)
    VALUES ('DEMO_REQUEST', 'Demo Request', 'Sent when someone requests a demo account');

IF NOT EXISTS (SELECT 1 FROM NotificationSettings WHERE EventCode = 'PASSWORD_RESET')
    INSERT INTO NotificationSettings (EventCode, EventName, Description)
    VALUES ('PASSWORD_RESET', 'Password Reset', 'Sent when a user password is reset by admin');

IF NOT EXISTS (SELECT 1 FROM NotificationSettings WHERE EventCode = 'WELCOME')
    INSERT INTO NotificationSettings (EventCode, EventName, Description)
    VALUES ('WELCOME', 'Welcome', 'Sent to new users when their account is created');

PRINT 'Seeded default notification events';
GO
