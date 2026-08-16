-- DropForeignKey
ALTER TABLE `Especialidad` DROP FOREIGN KEY `Especialidad_consultorioId_fkey`;

-- DropForeignKey
ALTER TABLE `ObraSocial` DROP FOREIGN KEY `ObraSocial_consultorioId_fkey`;

-- AlterTable
ALTER TABLE `Especialidad` ADD COLUMN `esSistema` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `consultorioId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ObraSocial` ADD COLUMN `esSistema` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `consultorioId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Profesional` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `ConsultorioEspecialidadOculta` (
    `consultorioId` INTEGER NOT NULL,
    `especialidadId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsultorioEspecialidadOculta_especialidadId_idx`(`especialidadId`),
    PRIMARY KEY (`consultorioId`, `especialidadId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsultorioObraSocialOculta` (
    `consultorioId` INTEGER NOT NULL,
    `obraSocialId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsultorioObraSocialOculta_obraSocialId_idx`(`obraSocialId`),
    PRIMARY KEY (`consultorioId`, `obraSocialId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Especialidad_esSistema_activo_idx` ON `Especialidad`(`esSistema`, `activo`);

-- CreateIndex
CREATE INDEX `ObraSocial_esSistema_activo_idx` ON `ObraSocial`(`esSistema`, `activo`);

-- AddForeignKey
ALTER TABLE `Especialidad` ADD CONSTRAINT `Especialidad_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultorioEspecialidadOculta` ADD CONSTRAINT `ConsultorioEspecialidadOculta_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultorioEspecialidadOculta` ADD CONSTRAINT `ConsultorioEspecialidadOculta_especialidadId_fkey` FOREIGN KEY (`especialidadId`) REFERENCES `Especialidad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ObraSocial` ADD CONSTRAINT `ObraSocial_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultorioObraSocialOculta` ADD CONSTRAINT `ConsultorioObraSocialOculta_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultorioObraSocialOculta` ADD CONSTRAINT `ConsultorioObraSocialOculta_obraSocialId_fkey` FOREIGN KEY (`obraSocialId`) REFERENCES `ObraSocial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
