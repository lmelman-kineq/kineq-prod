-- AlterTable
ALTER TABLE `EvolucionImagen` DROP COLUMN `url`;

-- AlterTable
ALTER TABLE `FichaEstudioComplementario` ADD COLUMN `archivoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `archivoNombreOriginal` VARCHAR(191) NULL,
    ADD COLUMN `archivoPathname` TEXT NULL,
    ADD COLUMN `archivoSizeBytes` INTEGER NULL;

-- AlterTable
ALTER TABLE `Paciente` ADD COLUMN `fotoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `fotoPathname` TEXT NULL;

-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `fotoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `fotoPathname` TEXT NULL;
