-- Add ProjectBrief columns to Projects table
-- The first feature request for each project is treated as the project brief/vision document

ALTER TABLE Projects ADD 
    ProjectBrief NVARCHAR(MAX) NULL,
    ProjectBriefSetAt DATETIME NULL;
