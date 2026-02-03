-- 010: Create Assets table and migrate FeaturedProjects to use asset references.
-- Pattern from funtime-shared: centralized asset management with ID-based file naming.

-- Step 1: Create Assets table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Assets')
BEGIN
    CREATE TABLE Assets (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        AssetType       NVARCHAR(20)   NOT NULL DEFAULT 'image',    -- image, video, document, audio, link
        FileName        NVARCHAR(255)  NOT NULL,                     -- original filename or title
        ContentType     NVARCHAR(100)  NOT NULL,                     -- MIME type
        FileSize        BIGINT         NOT NULL DEFAULT 0,           -- bytes (0 for links)
        StorageUrl      NVARCHAR(1000) NOT NULL DEFAULT '',          -- local path or S3 URL
        ExternalUrl     NVARCHAR(2000) NULL,                         -- YouTube, Vimeo, etc.
        ThumbnailUrl    NVARCHAR(1000) NULL,                         -- thumbnail for videos/links
        StorageType     NVARCHAR(20)   NOT NULL DEFAULT 'local',     -- local, s3, external
        Category        NVARCHAR(50)   NULL,                         -- organizational category
        SiteKey         NVARCHAR(50)   NULL,                         -- multi-tenant key
        UploadedBy      INT            NULL,                         -- FK to Users (nullable for system)
        IsPublic        BIT            NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_Assets_Category ON Assets(Category);
    CREATE INDEX IX_Assets_SiteKey ON Assets(SiteKey);
    CREATE INDEX IX_Assets_UploadedBy ON Assets(UploadedBy);
    CREATE INDEX IX_Assets_AssetType ON Assets(AssetType);

    PRINT 'Assets table created successfully.'
END
ELSE
BEGIN
    PRINT 'Assets table already exists.'
END

-- Step 2: Add ThumbnailAssetId to FeaturedProjects
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FeaturedProjects') AND name = 'ThumbnailAssetId')
BEGIN
    ALTER TABLE FeaturedProjects ADD ThumbnailAssetId INT NULL;
    PRINT 'Added ThumbnailAssetId column to FeaturedProjects.'
END
ELSE
BEGIN
    PRINT 'ThumbnailAssetId column already exists on FeaturedProjects.'
END
