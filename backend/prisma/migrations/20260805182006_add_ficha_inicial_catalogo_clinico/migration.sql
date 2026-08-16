-- AlterTable
ALTER TABLE `FichaInicial` DROP COLUMN `alergiasDetalle`,
    DROP COLUMN `medicacionDetalle`,
    ADD COLUMN `abortos` INTEGER NULL,
    ADD COLUMN `alcoholEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL,
    ADD COLUMN `aniosFumador` INTEGER NULL,
    ADD COLUMN `cigarrillosDiarios` INTEGER NULL,
    ADD COLUMN `edadMenarca` INTEGER NULL,
    ADD COLUMN `edadMenopausia` INTEGER NULL,
    ADD COLUMN `ejercicioMinutosDia` INTEGER NULL,
    ADD COLUMN `gestas` INTEGER NULL,
    ADD COLUMN `menarcaEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL,
    ADD COLUMN `menopausiaEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL,
    ADD COLUMN `observacionesGineco` VARCHAR(191) NULL,
    ADD COLUMN `partos` INTEGER NULL,
    ADD COLUMN `sedentarismoEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL,
    ADD COLUMN `tabaquismoEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL;

-- CreateTable
CREATE TABLE `CatalogoClinicoItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria` ENUM('ANTECEDENTE_PERSONAL', 'ANTECEDENTE_FAMILIAR', 'PROCEDIMIENTO_QUIRURGICO', 'ALERGIA') NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CatalogoClinicoItem_categoria_activo_idx`(`categoria`, `activo`),
    UNIQUE INDEX `CatalogoClinicoItem_categoria_codigo_key`(`categoria`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FichaAntecedente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `fichaInicialId` INTEGER NOT NULL,
    `catalogoItemId` INTEGER NOT NULL,
    `estado` ENUM('SI', 'NO', 'NO_INFORMA') NOT NULL,
    `detalle` VARCHAR(191) NULL,
    `fechaAproximada` DATETIME(3) NULL,
    `edadAproximada` INTEGER NULL,
    `parentesco` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FichaAntecedente_consultorioId_idx`(`consultorioId`),
    UNIQUE INDEX `FichaAntecedente_fichaInicialId_catalogoItemId_key`(`fichaInicialId`, `catalogoItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FichaAlergia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `fichaInicialId` INTEGER NOT NULL,
    `catalogoItemId` INTEGER NULL,
    `nombreLibre` VARCHAR(191) NULL,
    `reaccion` VARCHAR(191) NULL,
    `gravedad` ENUM('LEVE', 'MODERADA', 'GRAVE') NULL,
    `observaciones` VARCHAR(191) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FichaAlergia_consultorioId_idx`(`consultorioId`),
    INDEX `FichaAlergia_fichaInicialId_idx`(`fichaInicialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FichaMedicacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `fichaInicialId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `dosis` VARCHAR(191) NULL,
    `unidad` VARCHAR(191) NULL,
    `frecuencia` VARCHAR(191) NULL,
    `via` VARCHAR(191) NULL,
    `motivo` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FichaMedicacion_consultorioId_idx`(`consultorioId`),
    INDEX `FichaMedicacion_fichaInicialId_idx`(`fichaInicialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FichaEstudioComplementario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `fichaInicialId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `fecha` DATETIME(3) NULL,
    `resumen` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FichaEstudioComplementario_consultorioId_idx`(`consultorioId`),
    INDEX `FichaEstudioComplementario_fichaInicialId_idx`(`fichaInicialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FichaSeccionEstado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `fichaInicialId` INTEGER NOT NULL,
    `seccion` ENUM('MOTIVO', 'ANTECEDENTES', 'SEGURIDAD', 'HABITOS', 'DOLOR_FUNCION', 'ESTUDIOS') NOT NULL,
    `estado` ENUM('PENDIENTE', 'EN_PROGRESO', 'REVISADA') NOT NULL DEFAULT 'PENDIENTE',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FichaSeccionEstado_consultorioId_idx`(`consultorioId`),
    UNIQUE INDEX `FichaSeccionEstado_fichaInicialId_seccion_key`(`fichaInicialId`, `seccion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FichaAntecedente` ADD CONSTRAINT `FichaAntecedente_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAntecedente` ADD CONSTRAINT `FichaAntecedente_fichaInicialId_fkey` FOREIGN KEY (`fichaInicialId`) REFERENCES `FichaInicial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAntecedente` ADD CONSTRAINT `FichaAntecedente_catalogoItemId_fkey` FOREIGN KEY (`catalogoItemId`) REFERENCES `CatalogoClinicoItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAlergia` ADD CONSTRAINT `FichaAlergia_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAlergia` ADD CONSTRAINT `FichaAlergia_fichaInicialId_fkey` FOREIGN KEY (`fichaInicialId`) REFERENCES `FichaInicial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaAlergia` ADD CONSTRAINT `FichaAlergia_catalogoItemId_fkey` FOREIGN KEY (`catalogoItemId`) REFERENCES `CatalogoClinicoItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaMedicacion` ADD CONSTRAINT `FichaMedicacion_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaMedicacion` ADD CONSTRAINT `FichaMedicacion_fichaInicialId_fkey` FOREIGN KEY (`fichaInicialId`) REFERENCES `FichaInicial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaEstudioComplementario` ADD CONSTRAINT `FichaEstudioComplementario_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaEstudioComplementario` ADD CONSTRAINT `FichaEstudioComplementario_fichaInicialId_fkey` FOREIGN KEY (`fichaInicialId`) REFERENCES `FichaInicial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaSeccionEstado` ADD CONSTRAINT `FichaSeccionEstado_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaSeccionEstado` ADD CONSTRAINT `FichaSeccionEstado_fichaInicialId_fkey` FOREIGN KEY (`fichaInicialId`) REFERENCES `FichaInicial`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

