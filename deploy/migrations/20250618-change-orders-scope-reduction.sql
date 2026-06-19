-- Change orders, scope reduction, contract amendments, piece catalogue link.
-- Run once before deploying app code that depends on these columns.
-- Safe to re-run only if you use apply-db-migration.sh (skips existing columns).

-- Quote change-order fields
ALTER TABLE quote_requests ADD COLUMN parentProjectId VARCHAR(36) NULL;
ALTER TABLE quote_requests ADD COLUMN changeOrderNumber INT NULL;
ALTER TABLE quote_requests ADD COLUMN appliedAt DATETIME NULL;
ALTER TABLE quote_requests ADD COLUMN changeOrderType ENUM('addition', 'reduction') NULL;
ALTER TABLE quote_requests ADD COLUMN removalTargets JSON NULL;
ALTER TABLE quote_requests ADD COLUMN creditLineItems JSON NULL;

-- Piece catalogue link for scope reduction pricing
ALTER TABLE pieces ADD COLUMN catalogItemId VARCHAR(36) NULL;

-- Label scan tokens (QR check-in)
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

-- Contract amendments (revised contracts for change orders)
CREATE TABLE IF NOT EXISTS contract_amendments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  projectId VARCHAR(36) NOT NULL,
  quoteId VARCHAR(36) NOT NULL,
  versionNumber INT NOT NULL,
  proposalStorageKey VARCHAR(512) NOT NULL,
  proposalFilename VARCHAR(255) NOT NULL,
  quotedAmount DECIMAL(10,2) NULL,
  generatedByUserId VARCHAR(36) NULL,
  generatedByName VARCHAR(255) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX IDX_contract_amendments_project (projectId),
  INDEX IDX_contract_amendments_quote (quoteId),
  CONSTRAINT FK_contract_amendments_project FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT FK_contract_amendments_quote FOREIGN KEY (quoteId) REFERENCES quote_requests(id) ON DELETE CASCADE
);
