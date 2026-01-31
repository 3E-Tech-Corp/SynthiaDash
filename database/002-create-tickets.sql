-- 002-create-tickets.sql
-- Ticket system: Bug Reports & Feature Requests with tiered access

-- Add TicketAccess column to Users table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'TicketAccess')
BEGIN
    ALTER TABLE Users ADD TicketAccess NVARCHAR(20) NOT NULL DEFAULT 'none';
END
GO

-- Create Tickets table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tickets')
BEGIN
    CREATE TABLE Tickets (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Type NVARCHAR(20) NOT NULL,           -- 'bug' or 'feature'
        Title NVARCHAR(256) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        ImagePath NVARCHAR(512) NULL,          -- relative path to uploaded image
        RepoFullName NVARCHAR(256) NULL,       -- optional: which repo this relates to
        Status NVARCHAR(20) NOT NULL DEFAULT 'submitted',  -- submitted, in_progress, completed, closed
        AgentTaskId NVARCHAR(50) NULL,         -- link to AgentTask if auto-executed
        Result NVARCHAR(MAX) NULL,             -- agent result or admin notes
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CompletedAt DATETIME2 NULL,
        CONSTRAINT FK_Tickets_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_Tickets_UserId ON Tickets(UserId);
    CREATE INDEX IX_Tickets_Status ON Tickets(Status);
    CREATE INDEX IX_Tickets_Type ON Tickets(Type);
    CREATE INDEX IX_Tickets_CreatedAt ON Tickets(CreatedAt DESC);
END
GO
