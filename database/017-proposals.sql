-- 017-proposals.sql: Project Proposals system

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProjectProposals')
BEGIN
    CREATE TABLE ProjectProposals (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        RawDescription NVARCHAR(MAX) NOT NULL,
        PolishedDescription NVARCHAR(MAX) NULL,
        Problem NVARCHAR(MAX) NULL,
        ProposerRole NVARCHAR(50) NULL,
        ExpectedUsers INT NULL,
        ExpectedMonthlyValue DECIMAL(10,2) NULL,
        ShareToken NVARCHAR(50) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'draft',
        DeclineReason NVARCHAR(MAX) NULL,
        ProposerId INT NULL REFERENCES Users(Id),
        LikeCount INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE UNIQUE INDEX IX_Proposals_ShareToken ON ProjectProposals(ShareToken);
    CREATE INDEX IX_Proposals_Status ON ProjectProposals(Status);
    CREATE INDEX IX_Proposals_ProposerId ON ProjectProposals(ProposerId);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProposalFeatures')
BEGIN
    CREATE TABLE ProposalFeatures (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProposalId INT NOT NULL REFERENCES ProjectProposals(Id),
        Description NVARCHAR(1000) NOT NULL,
        AuthorId INT NULL REFERENCES Users(Id),
        AuthorName NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_ProposalFeatures_ProposalId ON ProposalFeatures(ProposalId);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProposalLikes')
BEGIN
    CREATE TABLE ProposalLikes (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProposalId INT NOT NULL REFERENCES ProjectProposals(Id),
        UserId INT NULL REFERENCES Users(Id),
        IsAnonymous BIT NOT NULL DEFAULT 0,
        IpHash NVARCHAR(64) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_ProposalLikes_ProposalId ON ProposalLikes(ProposalId);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProposalValueEstimates')
BEGIN
    CREATE TABLE ProposalValueEstimates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ProposalId INT NOT NULL REFERENCES ProjectProposals(Id),
        UserId INT NULL REFERENCES Users(Id),
        IsAnonymous BIT NOT NULL DEFAULT 0,
        WouldPay BIT NOT NULL DEFAULT 0,
        MonthlyAmount DECIMAL(10,2) NULL,
        Weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_ProposalValueEstimates_ProposalId ON ProposalValueEstimates(ProposalId);
END;
