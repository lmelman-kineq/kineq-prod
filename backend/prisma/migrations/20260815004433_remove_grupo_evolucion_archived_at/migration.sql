/*
  Warnings:

  - You are about to drop the column `archivedAt` on the `grupoevolucion` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `grupoevolucion` DROP FOREIGN KEY `GrupoEvolucion_consultorioId_fkey`;

-- DropIndex
DROP INDEX `GrupoEvolucion_consultorioId_pacienteId_archivedAt_idx` ON `grupoevolucion`;

-- AlterTable
ALTER TABLE `grupoevolucion` DROP COLUMN `archivedAt`;

-- CreateIndex
CREATE INDEX `GrupoEvolucion_consultorioId_pacienteId_idx` ON `GrupoEvolucion`(`consultorioId`, `pacienteId`);

-- AddForeignKey
ALTER TABLE `GrupoEvolucion` ADD CONSTRAINT `GrupoEvolucion_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
