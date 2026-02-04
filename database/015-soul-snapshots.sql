-- Soul Snapshots: versioned snapshots of SOUL.md
CREATE TABLE SoulSnapshots (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    [Date] DATE NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Summary NVARCHAR(1000) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    IsPublished BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Index for ordering
CREATE INDEX IX_SoulSnapshots_Date ON SoulSnapshots([Date] DESC);
