USE [Synthia];

-- Add VIP user Hong Yao (password: Synth!@, PBKDF2-SHA256 hash)
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'hong@synthia.bot')
BEGIN
    INSERT INTO Users (Email, DisplayName, PasswordHash, Role, MaxProjects, IsActive, ChatAccess, CreatedAt)
    VALUES (
        'hong@synthia.bot',
        'Hong Yao',
        'GCrepqJvMStYi2enTZolng==.2ufGz0SlicATbJavoXSmj1RVb24XbBUc9yZ5pGqLHd8=',
        'member',
        2,
        1,
        'vip',
        GETUTCDATE()
    );
    PRINT 'VIP user Hong Yao created.';
END
ELSE
    PRINT 'User already exists.';

SELECT Id, Email, DisplayName, Role, ChatAccess, MaxProjects FROM Users WHERE Email = 'hong@synthia.bot';
