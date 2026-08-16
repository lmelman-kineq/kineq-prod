-- AlterTable
ALTER TABLE `FichaEstudioComplementario` ADD COLUMN `profesionalId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `FichaEstudioComplementario` ADD CONSTRAINT `FichaEstudioComplementario_profesionalId_fkey` FOREIGN KEY (`profesionalId`) REFERENCES `Profesional`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
