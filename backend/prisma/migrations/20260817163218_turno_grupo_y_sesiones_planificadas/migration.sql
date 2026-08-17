-- AlterTable
ALTER TABLE `GrupoEvolucion` ADD COLUMN `cantidadSesionesPlanificadas` INTEGER NULL;

-- AlterTable
ALTER TABLE `Turno` ADD COLUMN `grupoId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Turno_grupoId_idx` ON `Turno`(`grupoId`);

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_grupoId_fkey` FOREIGN KEY (`grupoId`) REFERENCES `GrupoEvolucion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
