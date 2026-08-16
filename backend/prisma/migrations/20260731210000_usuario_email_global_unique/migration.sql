-- DropIndex
DROP INDEX `Usuario_consultorioId_email_key` ON `Usuario`;

-- CreateIndex
CREATE UNIQUE INDEX `Usuario_email_key` ON `Usuario`(`email`);
