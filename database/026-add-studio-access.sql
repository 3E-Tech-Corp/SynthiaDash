-- Add StudioAccess column to Users for Studio.Synthia.Bot access control
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'StudioAccess')
BEGIN
    ALTER TABLE Users ADD StudioAccess BIT NOT NULL DEFAULT 0;
END
GO

-- Grant studio access to admin users by default
UPDATE Users SET StudioAccess = 1 WHERE Role IN ('Admin', 'Developer');
GO
