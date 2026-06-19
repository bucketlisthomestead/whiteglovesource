-- Label scan tokens and project label PDF history (from prior label feature work).
-- Required before deploying code that references Piece.scanToken or project_label_pdfs.

ALTER TABLE pieces ADD COLUMN scanToken VARCHAR(16) NULL;
CREATE UNIQUE INDEX IDX_pieces_scanToken ON pieces (scanToken);

CREATE TABLE IF NOT EXISTS project_label_pdfs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  projectId VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  storageKey VARCHAR(512) NOT NULL,
  templateId VARCHAR(64) NOT NULL,
  pieceCount INT NOT NULL,
  jobNumber VARCHAR(32) NOT NULL,
  printedAt VARCHAR(64) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  createdByUserId VARCHAR(36) NULL,
  createdByName VARCHAR(255) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX IDX_project_label_pdfs_project (projectId),
  CONSTRAINT FK_project_label_pdfs_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);
