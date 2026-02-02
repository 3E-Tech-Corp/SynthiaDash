-- 007: Bind existing users to their projects
-- Reassign existing projects from Feng to the actual users

-- Project 1 (test-project) → Tomas Rosales (id:3)
UPDATE Projects SET CreatedByUserId = 3 WHERE Id = 1 AND RepoFullName = '3E-Tech-Corp/test-project';

-- Project 2 (sudoku) → Xin Luo (id:6)
UPDATE Projects SET CreatedByUserId = 6 WHERE Id = 2 AND RepoFullName = '3E-Tech-Corp/sudoku';

-- Project 3 (arthur) → Arthur Xiao (id:5)
UPDATE Projects SET CreatedByUserId = 5 WHERE Id = 3 AND RepoFullName = '3E-Tech-Corp/arthur';

-- Create project for Zhijian Dev (user 2) → 3E-Tech-Corp/Zhijian
IF NOT EXISTS (SELECT 1 FROM Projects WHERE RepoFullName = '3E-Tech-Corp/Zhijian')
INSERT INTO Projects (Name, Slug, Domain, RepoFullName, DatabaseName, IisSiteName, Status, CreatedByUserId, CreatedAt)
VALUES ('Zhijian', 'zhijian', 'zhijian.synthia.bot', '3E-Tech-Corp/Zhijian', 'Zhijian', 'Zhijian', 'ready', 2, GETUTCDATE());

-- Create project for Tomas (user 3) → 3E-Tech-Corp/tom-project (dressapp.synthia.bot)
IF NOT EXISTS (SELECT 1 FROM Projects WHERE RepoFullName = '3E-Tech-Corp/tom-project')
INSERT INTO Projects (Name, Slug, Domain, RepoFullName, DatabaseName, IisSiteName, Status, CreatedByUserId, CreatedAt)
VALUES ('Tom Project', 'tom-project', 'dressapp.synthia.bot', '3E-Tech-Corp/tom-project', 'Demo_1_TomProject', 'Demo_1_TomProject', 'ready', 3, GETUTCDATE());

-- Create project for Weihe Gong (user 4) → 3E-Tech-Corp/Pickleball-Community
IF NOT EXISTS (SELECT 1 FROM Projects WHERE RepoFullName = '3E-Tech-Corp/Pickleball-Community')
INSERT INTO Projects (Name, Slug, Domain, RepoFullName, DatabaseName, IisSiteName, Status, CreatedByUserId, CreatedAt)
VALUES ('Pickleball Community', 'pickleball-community', 'pickleball.community', '3E-Tech-Corp/Pickleball-Community', 'PickleballCommunity', 'pickleball.community', 'ready', 4, GETUTCDATE());

-- Tomas now has 2 projects (test-project + tom-project), bump his max
UPDATE Users SET MaxProjects = 2 WHERE Id = 3;

-- Verify
SELECT p.Id, p.Name, p.RepoFullName, p.Domain, p.Status, p.CreatedByUserId, u.DisplayName AS Owner
FROM Projects p
LEFT JOIN Users u ON p.CreatedByUserId = u.Id
ORDER BY p.Id;
