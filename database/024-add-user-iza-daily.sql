USE [Synthia];

-- Add VIP user Iza Daily (password: Welcome2Synthia!, PBKDF2-SHA256 hash)
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'iza.daily@icloud.com')
BEGIN
    INSERT INTO Users (Email, DisplayName, PasswordHash, Role, MaxProjects, IsActive, ChatAccess, FullChatAccess, CreatedAt)
    VALUES (
        'iza.daily@icloud.com',
        'Iza Daily',
        'OybnKEt8vPAn0H21db+/2Q==./Zz+jHWm1x+3c235RgOHEllyFe909esOHziV3dfDKiw=',
        'member',
        2,
        1,
        'vip',
        1,
        GETUTCDATE()
    );
    PRINT 'VIP user Iza Daily created.';
END
ELSE
    PRINT 'User already exists.';

SELECT Id, Email, DisplayName, Role, ChatAccess, FullChatAccess, MaxProjects FROM Users WHERE Email = 'iza.daily@icloud.com';
