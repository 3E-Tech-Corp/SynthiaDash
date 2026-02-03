-- 009: Create FeaturedProjects table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FeaturedProjects')
BEGIN
    CREATE TABLE FeaturedProjects (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        ProjectId INT NULL,
        Url NVARCHAR(500) NOT NULL,
        ThumbnailPath NVARCHAR(500) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_FeaturedProjects_Projects FOREIGN KEY (ProjectId) REFERENCES Projects(Id)
    );

    CREATE INDEX IX_FeaturedProjects_SortOrder ON FeaturedProjects(SortOrder);
    CREATE INDEX IX_FeaturedProjects_IsActive ON FeaturedProjects(IsActive);

    PRINT 'FeaturedProjects table created successfully.'
END
ELSE
BEGIN
    PRINT 'FeaturedProjects table already exists.'
END
