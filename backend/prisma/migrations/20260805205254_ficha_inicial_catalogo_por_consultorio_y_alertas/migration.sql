-- DropIndex
DROP INDEX `CatalogoClinicoItem_categoria_codigo_key` ON `catalogoclinicoitem`;

-- AlterTable
ALTER TABLE `catalogoclinicoitem` ADD COLUMN `consultorioId` INTEGER NULL,
    ADD COLUMN `esSistema` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `fichaantecedente` ADD COLUMN `esAlertaClinica` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `fichamedicacion` ADD COLUMN `esAlertaClinica` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `CatalogoClinicoItem_consultorioId_idx` ON `CatalogoClinicoItem`(`consultorioId`);

-- CreateIndex
CREATE UNIQUE INDEX `CatalogoClinicoItem_consultorioId_categoria_codigo_key` ON `CatalogoClinicoItem`(`consultorioId`, `categoria`, `codigo`);

-- AddForeignKey
ALTER TABLE `CatalogoClinicoItem` ADD CONSTRAINT `CatalogoClinicoItem_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

