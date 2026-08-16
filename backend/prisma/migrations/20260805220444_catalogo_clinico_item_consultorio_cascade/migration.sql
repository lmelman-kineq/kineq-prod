-- DropForeignKey
ALTER TABLE `CatalogoClinicoItem` DROP FOREIGN KEY `CatalogoClinicoItem_consultorioId_fkey`;

-- AddForeignKey
ALTER TABLE `CatalogoClinicoItem` ADD CONSTRAINT `CatalogoClinicoItem_consultorioId_fkey` FOREIGN KEY (`consultorioId`) REFERENCES `Consultorio`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
