IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DemoRequests')
CREATE TABLE DemoRequests (
    Id INT IDENTITY PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL,
    Name NVARCHAR(255) NOT NULL,
    Reason NVARCHAR(2000) NOT NULL,
    IpAddress NVARCHAR(45) NULL,
    Location NVARCHAR(255) NULL,
    Status NVARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    ReviewedAt DATETIME2 NULL,
    ReviewedBy INT NULL
);
