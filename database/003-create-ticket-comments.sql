-- 003-create-ticket-comments.sql
-- Ticket Comments / Activity Feed: users and admins can comment on tickets,
-- system messages are auto-generated on status changes.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TicketComments')
BEGIN
    CREATE TABLE TicketComments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TicketId INT NOT NULL,
        UserId INT NULL,                         -- NULL for system-generated messages
        UserDisplayName NVARCHAR(128) NOT NULL,
        Comment NVARCHAR(MAX) NOT NULL,
        IsSystemMessage BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TicketComments_Tickets FOREIGN KEY (TicketId) REFERENCES Tickets(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TicketComments_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_TicketComments_TicketId ON TicketComments(TicketId);
    CREATE INDEX IX_TicketComments_CreatedAt ON TicketComments(CreatedAt);
END
GO
