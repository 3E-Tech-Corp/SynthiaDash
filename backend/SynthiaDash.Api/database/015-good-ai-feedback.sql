-- Good AI Initiative Feedback
-- Created: 2026-02-09

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GoodAiFeedback')
BEGIN
    CREATE TABLE GoodAiFeedback (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Email NVARCHAR(255) NULL,
        Message NVARCHAR(2000) NOT NULL,
        Organization NVARCHAR(200) NULL,
        IsApproved BIT NOT NULL DEFAULT 0,
        IsPublic BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_GoodAiFeedback_Approved ON GoodAiFeedback (IsApproved, IsPublic, CreatedAt DESC);
    
    PRINT 'Created GoodAiFeedback table';
END
GO
