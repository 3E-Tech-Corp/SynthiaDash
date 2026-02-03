-- 011-project-members.sql
-- Add ProjectMembers junction table for multi-user project access

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProjectMembers')
BEGIN
    CREATE TABLE ProjectMembers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProjectId INT NOT NULL,
        UserId INT NOT NULL,
        Role NVARCHAR(20) NOT NULL DEFAULT 'developer', -- owner, developer, viewer
        AddedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        AddedBy INT NULL,
        CONSTRAINT FK_ProjectMembers_Projects FOREIGN KEY (ProjectId) REFERENCES Projects(Id),
        CONSTRAINT FK_ProjectMembers_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT UQ_ProjectMembers UNIQUE (ProjectId, UserId)
    );

    PRINT 'Created ProjectMembers table';
END
ELSE
BEGIN
    PRINT 'ProjectMembers table already exists';
END
GO

-- Data migration: insert existing project creators as owners
INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedAt, AddedBy)
SELECT p.Id, p.CreatedByUserId, 'owner', p.CreatedAt, NULL
FROM Projects p
WHERE NOT EXISTS (
    SELECT 1 FROM ProjectMembers pm
    WHERE pm.ProjectId = p.Id AND pm.UserId = p.CreatedByUserId
);

PRINT 'Migrated existing project creators as owners';
GO
