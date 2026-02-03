IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RefreshTokens')
CREATE TABLE RefreshTokens (
    Id INT IDENTITY PRIMARY KEY,
    UserId INT NOT NULL REFERENCES Users(Id) ON DELETE CASCADE,
    Token NVARCHAR(128) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    RevokedAt DATETIME2 NULL,
    ReplacedByToken NVARCHAR(128) NULL,
    CONSTRAINT UQ_RefreshTokens_Token UNIQUE (Token)
);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RefreshTokens_Token')
CREATE INDEX IX_RefreshTokens_Token ON RefreshTokens(Token) WHERE RevokedAt IS NULL;
