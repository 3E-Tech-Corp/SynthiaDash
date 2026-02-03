USE [Synthia];

-- Add user Indy Aysmona (password: Synth!@, PBKDF2-SHA256 hash)
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'inaysmona20@gmail.com')
BEGIN
    INSERT INTO Users (Email, DisplayName, PasswordHash, Role, MaxProjects, IsActive, CreatedAt)
    VALUES (
        'inaysmona20@gmail.com',
        'Indy Aysmona',
        'XrBR1G6NO04XHmp93pulEA==.oMHqIckEbWIBh8ssYOLytCV5uQQtvgLH9lDMPa8uR4w=',
        'member',
        1,
        1,
        GETUTCDATE()
    );
    PRINT 'User Indy Aysmona created.';
END
ELSE
    PRINT 'User already exists.';

SELECT Id, Email, DisplayName, Role, MaxProjects FROM Users WHERE Email = 'inaysmona20@gmail.com';
