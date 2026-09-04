-- AlterTable
ALTER TABLE `Turno` ADD COLUMN `ordenEnSerie` INTEGER NULL,
    ADD COLUMN `serieId` INTEGER NULL;

-- CreateTable
CREATE TABLE `SerieTurno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `frecuenciaSemanas` INTEGER NOT NULL,
    `cantidadSesiones` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SerieTurno_consultorioId_idx`(`consultorioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Turno_serieId_idx` ON `Turno`(`serieId`);

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_serieId_fkey` FOREIGN KEY (`serieId`) REFERENCES `SerieTurno`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SerieTurno` ADD CONSTRAINT `SerieTurno_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
