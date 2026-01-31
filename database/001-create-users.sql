-- SynthiaDash User Auth Schema
-- Run against: Synthia database on FTPB1

USE [Synthia];
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(256) NOT NULL,
        DisplayName NVARCHAR(128) NOT NULL,
        PasswordHash NVARCHAR(512) NOT NULL,
        Role NVARCHAR(20) NOT NULL DEFAULT 'viewer',  -- admin, member, viewer
        Repos NVARCHAR(MAX) NULL,  -- JSON array of repo names, NULL = based on role
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastLoginAt DATETIME2 NULL,
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );

    CREATE INDEX IX_Users_Email ON Users(Email);

    PRINT 'Users table created.';
END
ELSE
BEGIN
    PRINT 'Users table already exists.';
END
GO
