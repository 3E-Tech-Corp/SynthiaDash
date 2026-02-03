USE [Synthia];
GO

-- Add user Indy Aysmona
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'inaysmona20@gmail.com')
BEGIN
    -- Default password: Synth!@ (same as other demo users)
    -- BCrypt hash for Synth!@
    INSERT INTO Users (Email, DisplayName, PasswordHash, Role, MaxProjects, IsActive, CreatedAt)
    VALUES (
        'inaysmona20@gmail.com',
        'Indy Aysmona',
        '$2a$11$rZbVCfQKlEmmEh8JkCqS5OXPSQJXBMhCNFDmOHQRqZJlAQOSxaOaG',
        'member',
        1,
        1,
        GETUTCDATE()
    );
    PRINT 'User Indy Aysmona created successfully.';
END
ELSE
BEGIN
    PRINT 'User already exists.';
END
GO
