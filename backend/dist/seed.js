"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./prisma"));
const client_1 = require("./generated/prisma/client");
const ESPECIALIDADES_BASE = [
    { nombre: 'Kinesiología general', color: '#602DE6' },
    { nombre: 'Rehabilitación deportiva', color: '#0F8A7B' },
    { nombre: 'Terapia manual', color: '#D97706' },
    { nombre: 'Osteopatía', color: '#7D52E8' },
    { nombre: 'Reeducación postural', color: '#0284C7' },
];
const OBRAS_SOCIALES_BASE = [
    { nombre: 'OSDE' },
    { nombre: 'Swiss Medical' },
    { nombre: 'Galeno' },
    { nombre: 'Medifé' },
    { nombre: 'Sancor Salud' },
];
const personales = [
    ['hiv-sida', 'HIV/SIDA'],
    ['tabaquismo', 'Tabaquismo'],
    ['ex-tabaquismo', 'Ex tabaquismo'],
    ['alcohol', 'Consumo de alcohol'],
    ['sedentarismo', 'Sedentarismo'],
    ['hta', 'HTA'],
    ['uso-antihipertensivos', 'Uso de antihipertensivos'],
    ['dislipidemia', 'Dislipidemia'],
    ['iam', 'IAM'],
    ['enfermedad-coronaria-sin-iam', 'Enfermedad coronaria (sin IAM)'],
    ['arritmia', 'Arritmia'],
    ['aneurisma-aorta-abdominal', 'Aneurisma de aorta abdominal'],
    ['enfermedad-vascular-periferica', 'Enfermedad vascular periférica'],
    ['insuficiencia-cardiaca', 'Insuficiencia cardíaca'],
    ['acv-isquemico', 'ACV isquémico'],
    ['acv-hemorragico', 'ACV hemorrágico'],
    ['depresion', 'Depresión'],
    ['demencia', 'Demencia'],
    ['institucionalizacion', 'Institucionalización'],
    ['parkinson', 'Parkinson'],
    ['irc', 'IRC'],
    ['cirrosis', 'Cirrosis'],
    ['hda', 'HDA'],
    ['hdb', 'HDB'],
    ['diabetes', 'Diabetes'],
    ['enfermedad-tiroidea', 'Enfermedad tiroidea'],
    ['bocio', 'Bocio'],
    ['epoc', 'EPOC'],
    ['asma', 'Asma'],
    ['tepa', 'TEPA'],
    ['diatesis-hemorragica', 'Diátesis hemorrágica'],
    ['prostatismo', 'Prostatismo'],
    ['litiasis-renal', 'Litiasis renal'],
    ['glaucoma', 'Glaucoma'],
    ['trombosis-venosa-profunda', 'Trombosis venosa profunda'],
    ['cancer-colon', 'Cáncer de colon'],
    ['cancer-pulmon', 'Cáncer de pulmón'],
    ['cancer-mama', 'Cáncer de mama'],
    ['cancer-ovario', 'Cáncer de ovario'],
    ['cancer-prostata', 'Cáncer de próstata'],
    ['cancer-rinon', 'Cáncer de riñón'],
    ['lupus-eritematoso-sistemico', 'Lupus eritematoso sistémico'],
    ['artritis-reumatoidea', 'Artritis reumatoidea'],
    ['vasculitis', 'Vasculitis'],
    ['otras-enfermedades-autoinmunes', 'Otras enfermedades autoinmunes'],
    ['tratamiento-cronico-corticoides', 'Tratamiento crónico con corticoides'],
    ['otros-antecedentes-personales', 'Otros antecedentes personales'],
];
const familiares = [
    ['asma', 'Asma'],
    ['hta', 'HTA'],
    ['diabetes', 'Diabetes'],
    ['dislipidemia', 'Dislipidemia'],
    ['iam', 'IAM'],
    ['cardiopatia-isquemica', 'Cardiopatía isquémica'],
    ['acv-isquemico', 'ACV isquémico'],
    ['acv-hemorragico', 'ACV hemorrágico'],
    ['cancer-colon', 'Cáncer de colon'],
    ['cancer-pulmon', 'Cáncer de pulmón'],
    ['cancer-mama', 'Cáncer de mama'],
    ['cancer-ovario', 'Cáncer de ovario'],
    ['cancer-prostata', 'Cáncer de próstata'],
    ['cancer-rinon', 'Cáncer de riñón'],
    ['enfermedades-autoinmunes', 'Enfermedades autoinmunes'],
    ['enfermedad-tiroidea', 'Enfermedad tiroidea'],
    ['otros-antecedentes-familiares', 'Otros antecedentes familiares'],
];
const quirurgicos = [
    ['angioplastia-coronaria', 'Angioplastia coronaria'],
    ['bypass-aortocoronario', 'Bypass aortocoronario'],
    ['esplenectomia', 'Esplenectomía'],
    ['colecistectomia-clasica', 'Colecistectomía clásica'],
    ['colecistectomia-laparoscopica', 'Colecistectomía laparoscópica'],
    ['apendicectomia', 'Apendicectomía'],
    ['hernioplastia-inguinal', 'Hernioplastia inguinal'],
    ['amigdalectomia', 'Amigdalectomía'],
    ['hemorroidectomia', 'Hemorroidectomía'],
    ['cesarea', 'Cesárea'],
    ['histerectomia', 'Histerectomía'],
    ['trasplante', 'Trasplante'],
    ['otros-procedimientos', 'Otros procedimientos'],
];
const alergias = [
    ['penicilina', 'Penicilina'],
    ['iodo', 'Iodo'],
    ['dipirona', 'Dipirona'],
    ['aspirina', 'Aspirina'],
    ['aines', 'AINEs'],
    ['latex', 'Látex'],
    ['contraste-iodado', 'Contraste iodado'],
    ['otras-alergias', 'Otras alergias'],
];
function catalogo(categoria, rows) {
    return rows.map(([codigo, nombre], index) => ({
        categoria,
        codigo,
        nombre,
        orden: (index + 1) * 10,
    }));
}
const CATALOGO_CLINICO_BASE = [
    ...catalogo(client_1.CategoriaCatalogoClinico.ANTECEDENTE_PERSONAL, personales),
    ...catalogo(client_1.CategoriaCatalogoClinico.ANTECEDENTE_FAMILIAR, familiares),
    ...catalogo(client_1.CategoriaCatalogoClinico.PROCEDIMIENTO_QUIRURGICO, quirurgicos),
    ...catalogo(client_1.CategoriaCatalogoClinico.ALERGIA, alergias),
];
async function seedEspecialidades() {
    console.log('→ Especialidades globales');
    for (const item of ESPECIALIDADES_BASE) {
        // MySQL permite múltiples NULL en un UNIQUE compuesto, por eso no
        // dependemos de @@unique([consultorioId, nombre]) para filas globales.
        const existente = await prisma_1.default.especialidad.findFirst({
            where: {
                consultorioId: null,
                esSistema: true,
                nombre: item.nombre,
            },
        });
        if (existente) {
            await prisma_1.default.especialidad.update({
                where: { id: existente.id },
                data: { color: item.color, activo: true, esSistema: true },
            });
        }
        else {
            await prisma_1.default.especialidad.create({
                data: {
                    consultorioId: null,
                    esSistema: true,
                    nombre: item.nombre,
                    color: item.color,
                    activo: true,
                },
            });
        }
    }
    console.log(`  ✓ ${ESPECIALIDADES_BASE.length}`);
}
async function seedObrasSociales() {
    console.log('→ Obras sociales globales');
    for (const item of OBRAS_SOCIALES_BASE) {
        const existente = await prisma_1.default.obraSocial.findFirst({
            where: {
                consultorioId: null,
                esSistema: true,
                nombre: item.nombre,
            },
        });
        if (existente) {
            await prisma_1.default.obraSocial.update({
                where: { id: existente.id },
                data: { activo: true, esSistema: true },
            });
        }
        else {
            await prisma_1.default.obraSocial.create({
                data: {
                    consultorioId: null,
                    esSistema: true,
                    nombre: item.nombre,
                    activo: true,
                },
            });
        }
    }
    console.log(`  ✓ ${OBRAS_SOCIALES_BASE.length}`);
}
async function seedCatalogoClinico() {
    console.log('→ Catálogo clínico global');
    for (const item of CATALOGO_CLINICO_BASE) {
        // El mismo cuidado aplica a @@unique([consultorioId, categoria, codigo])
        // porque consultorioId es NULL para los ítems del sistema.
        const existente = await prisma_1.default.catalogoClinicoItem.findFirst({
            where: {
                consultorioId: null,
                esSistema: true,
                categoria: item.categoria,
                codigo: item.codigo,
            },
        });
        if (existente) {
            await prisma_1.default.catalogoClinicoItem.update({
                where: { id: existente.id },
                data: {
                    nombre: item.nombre,
                    descripcion: item.descripcion ?? null,
                    activo: true,
                    esSistema: true,
                    orden: item.orden,
                },
            });
        }
        else {
            await prisma_1.default.catalogoClinicoItem.create({
                data: {
                    categoria: item.categoria,
                    codigo: item.codigo,
                    nombre: item.nombre,
                    descripcion: item.descripcion ?? null,
                    esSistema: true,
                    consultorioId: null,
                    activo: true,
                    orden: item.orden,
                },
            });
        }
    }
    console.log(`  ✓ ${CATALOGO_CLINICO_BASE.length}`);
}
async function printSummary() {
    const [especialidades, obrasSociales, personalesCount, familiaresCount, quirurgicosCount, alergiasCount] = await Promise.all([
        prisma_1.default.especialidad.count({ where: { consultorioId: null, esSistema: true, activo: true } }),
        prisma_1.default.obraSocial.count({ where: { consultorioId: null, esSistema: true, activo: true } }),
        prisma_1.default.catalogoClinicoItem.count({
            where: {
                consultorioId: null,
                esSistema: true,
                activo: true,
                categoria: client_1.CategoriaCatalogoClinico.ANTECEDENTE_PERSONAL,
            },
        }),
        prisma_1.default.catalogoClinicoItem.count({
            where: {
                consultorioId: null,
                esSistema: true,
                activo: true,
                categoria: client_1.CategoriaCatalogoClinico.ANTECEDENTE_FAMILIAR,
            },
        }),
        prisma_1.default.catalogoClinicoItem.count({
            where: {
                consultorioId: null,
                esSistema: true,
                activo: true,
                categoria: client_1.CategoriaCatalogoClinico.PROCEDIMIENTO_QUIRURGICO,
            },
        }),
        prisma_1.default.catalogoClinicoItem.count({
            where: {
                consultorioId: null,
                esSistema: true,
                activo: true,
                categoria: client_1.CategoriaCatalogoClinico.ALERGIA,
            },
        }),
    ]);
    console.log('\nSeed base de Kineq completado.');
    console.log('--------------------------------');
    console.log(`Especialidades globales:    ${especialidades}`);
    console.log(`Obras sociales globales:    ${obrasSociales}`);
    console.log(`Antecedentes personales:    ${personalesCount}`);
    console.log(`Antecedentes familiares:    ${familiaresCount}`);
    console.log(`Procedimientos quirúrgicos: ${quirurgicosCount}`);
    console.log(`Alergias globales:          ${alergiasCount}`);
}
async function main() {
    console.log('Inicializando datos base de Kineq...\n');
    await seedEspecialidades();
    await seedObrasSociales();
    await seedCatalogoClinico();
    await printSummary();
}
main()
    .catch((error) => {
    console.error('\nError al inicializar la base de Kineq:');
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
//# sourceMappingURL=seed.js.map