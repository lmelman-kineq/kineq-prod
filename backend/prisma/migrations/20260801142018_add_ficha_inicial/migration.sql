-- CreateTable
CREATE TABLE `FichaInicial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consultorioId` INTEGER NOT NULL,
    `pacienteId` INTEGER NOT NULL,
    `profesionalResponsableId` INTEGER NULL,
    `motivoConsulta` VARCHAR(191) NULL,
    `fechaInicioProblema` DATETIME(3) NULL,
    `diagnosticoDerivacion` VARCHAR(191) NULL,
    `objetivoPaciente` VARCHAR(191) NULL,
    `antecedentesPersonales` VARCHAR(191) NULL,
    `antecedentesFamiliares` VARCHAR(191) NULL,
    `cirugias` VARCHAR(191) NULL,
    `traumatismosAccidentes` VARCHAR(191) NULL,
    `tratamientosPrevios` VARCHAR(191) NULL,
    `alergiasEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL,
    `alergiasDetalle` VARCHAR(191) NULL,
    `medicacionEstado` ENUM('SI', 'NO', 'NO_INFORMA') NULL,
    `medicacionDetalle` VARCHAR(191) NULL,
    `enfermedadesActuales` VARCHAR(191) NULL,
    `actividadFisica` VARCHAR(191) NULL,
    `deportes` VARCHAR(191) NULL,
    `ocupacion` VARCHAR(191) NULL,
    `limitacionesFuncionales` VARCHAR(191) NULL,
    `estudiosComplementarios` VARCHAR(191) NULL,
    `dolorSintomas` VARCHAR(191) NULL,
    `hallazgosIniciales` VARCHAR(191) NULL,
    `observacionesClinicas` VARCHAR(191) NULL,
    `estado` ENUM('BORRADOR', 'COMPLETA') NOT NULL DEFAULT 'BORRADOR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FichaInicial_pacienteId_key`(`pacienteId`),
    INDEX `FichaInicial_consultorioId_idx`(`consultorioId`),
    INDEX `FichaInicial_profesionalResponsableId_idx`(`profesionalResponsableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FichaInicial` ADD CONSTRAINT `FichaInicial_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaInicial` ADD CONSTRAINT `FichaInicial_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `Paciente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FichaInicial` ADD CONSTRAINT `FichaInicial_profesionalResponsableId_fkey` FOREIGN KEY (`profesionalResponsableId`) REFERENCES `Profesional`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
