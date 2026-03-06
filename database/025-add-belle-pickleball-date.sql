USE [Synthia];

-- Add user Belle@synthia.bot (password: Welcome2Synthia!, PBKDF2-SHA256 hash)
DECLARE @BelleId INT;

IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'belle@synthia.bot')
BEGIN
    INSERT INTO Users (Email, DisplayName, PasswordHash, Role, MaxProjects, IsActive, ChatAccess, FullChatAccess, CreatedAt)
    VALUES (
        'belle@synthia.bot',
        'Belle',
        'OybnKEt8vPAn0H21db+/2Q==./Zz+jHWm1x+3c235RgOHEllyFe909esOHziV3dfDKiw=',
        'member',
        2,
        1,
        'vip',
        1,
        GETUTCDATE()
    );
    SET @BelleId = SCOPE_IDENTITY();
    PRINT 'User Belle created with ID: ' + CAST(@BelleId AS VARCHAR);
END
ELSE
BEGIN
    SELECT @BelleId = Id FROM Users WHERE Email = 'belle@synthia.bot';
    PRINT 'User Belle already exists with ID: ' + CAST(@BelleId AS VARCHAR);
    
    -- Ensure Belle has VIP chat access
    UPDATE Users SET ChatAccess = 'vip', FullChatAccess = 1, MaxProjects = 2 WHERE Id = @BelleId;
END

-- Create Pickleball-Date project for Belle
IF NOT EXISTS (SELECT 1 FROM Projects WHERE RepoFullName = '3E-Tech-Corp/Pickleball-Date')
BEGIN
    INSERT INTO Projects (Name, Slug, Domain, RepoFullName, DatabaseName, IisSiteName, Status, CreatedByUserId, CreatedAt, ReadyAt)
    VALUES (
        'Pickleball Date',
        'pickleball-date',
        'pickleball.date',
        '3E-Tech-Corp/Pickleball-Date',
        '',
        'Pickleball-Date',
        'ready',
        @BelleId,
        GETUTCDATE(),
        GETUTCDATE()
    );
    
    DECLARE @ProjectId INT = SCOPE_IDENTITY();
    
    -- Add Belle as project owner
    INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedBy, BugAccess, FeatureAccess, ChatAccess)
    VALUES (@ProjectId, @BelleId, 'owner', @BelleId, 'full', 'full', 'full');
    
    PRINT 'Project Pickleball Date created with ID: ' + CAST(@ProjectId AS VARCHAR);
END
ELSE
BEGIN
    PRINT 'Project Pickleball-Date already exists';
    
    -- Ensure Belle is a member with full access
    DECLARE @ExistingProjectId INT;
    SELECT @ExistingProjectId = Id FROM Projects WHERE RepoFullName = '3E-Tech-Corp/Pickleball-Date';
    
    IF NOT EXISTS (SELECT 1 FROM ProjectMembers WHERE ProjectId = @ExistingProjectId AND UserId = @BelleId)
    BEGIN
        INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedBy, BugAccess, FeatureAccess, ChatAccess)
        VALUES (@ExistingProjectId, @BelleId, 'owner', @BelleId, 'full', 'full', 'full');
        PRINT 'Added Belle as owner to existing project';
    END
    ELSE
    BEGIN
        UPDATE ProjectMembers SET Role = 'owner', BugAccess = 'full', FeatureAccess = 'full', ChatAccess = 'full'
        WHERE ProjectId = @ExistingProjectId AND UserId = @BelleId;
        PRINT 'Updated Belle permissions on existing project';
    END
END

-- Verify
SELECT u.Id, u.Email, u.DisplayName, u.Role, u.ChatAccess, u.FullChatAccess, u.MaxProjects 
FROM Users u WHERE u.Email = 'belle@synthia.bot';

SELECT p.Id, p.Name, p.RepoFullName, p.Domain, p.Status, pm.Role, pm.BugAccess, pm.FeatureAccess, pm.ChatAccess
FROM Projects p
JOIN ProjectMembers pm ON pm.ProjectId = p.Id
JOIN Users u ON pm.UserId = u.Id
WHERE u.Email = 'belle@synthia.bot';
