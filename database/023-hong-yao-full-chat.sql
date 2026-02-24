USE [Synthia];

-- Grant Hong Yao full chat access (VIP bot)
UPDATE Users 
SET FullChatAccess = 1
WHERE Email = 'hong@synthia.bot';

SELECT Id, Email, DisplayName, ChatAccess, FullChatAccess 
FROM Users 
WHERE Email = 'hong@synthia.bot';
