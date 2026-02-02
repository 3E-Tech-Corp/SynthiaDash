-- Add MaxProjects to Users (default 1)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'MaxProjects')
    ALTER TABLE Users ADD MaxProjects INT NOT NULL DEFAULT 1;

-- Add Description to Projects
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Projects') AND name = 'Description')
    ALTER TABLE Projects ADD Description NVARCHAR(MAX) NULL;
