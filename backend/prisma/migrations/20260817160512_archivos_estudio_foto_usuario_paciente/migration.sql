-- AlterTable
ALTER TABLE `evolucionimagen` DROP COLUMN `url`;

-- AlterTable
ALTER TABLE `fichaestudiocomplementario` ADD COLUMN `archivoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `archivoNombreOriginal` VARCHAR(191) NULL,
    ADD COLUMN `archivoPathname` TEXT NULL,
    ADD COLUMN `archivoSizeBytes` INTEGER NULL;

-- AlterTable
ALTER TABLE `paciente` ADD COLUMN `fotoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `fotoPathname` TEXT NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `fotoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `fotoPathname` TEXT NULL;
