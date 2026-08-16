const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();
(async () => {
  const consultorioId = 111;
  await prisma.fichaAntecedente.deleteMany({ where: { consultorioId } });
  await prisma.fichaSeccionEstado.deleteMany({ where: { consultorioId } });
  await prisma.fichaInicial.deleteMany({ where: { consultorioId } });
  await prisma.paciente.deleteMany({ where: { consultorioId } });
  await prisma.usuario.deleteMany({ where: { consultorioId } });
  await prisma.consultorio.deleteMany({ where: { id: consultorioId } });
  console.log('cleaned up test consultorio 111');
  await prisma.$disconnect();
})();
