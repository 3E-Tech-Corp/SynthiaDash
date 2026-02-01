-- Add ChatAccess column to Users
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ChatAccess')
    ALTER TABLE Users ADD ChatAccess NVARCHAR(20) NOT NULL DEFAULT 'none';

-- Create ChatMessages table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatMessages')
BEGIN
    CREATE TABLE ChatMessages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        SessionKey NVARCHAR(200) NOT NULL,
        Role NVARCHAR(20) NOT NULL, -- user, assistant
        Content NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_ChatMessages_Session ON ChatMessages(SessionKey, CreatedAt);
END
