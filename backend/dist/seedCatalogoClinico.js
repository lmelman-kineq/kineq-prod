"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCatalogoClinico = seedCatalogoClinico;
const prisma_1 = __importDefault(require("./prisma"));
function slugify(nombre) {
    return nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
// Catálogo clínico: dato de sistema (sin consultorioId, ver decisión en el
// plan de rediseño de Ficha Inicial), no dato demo — debe existir en
// cualquier ambiente, no solo en el consultorio demo IAFS. Por eso vive en
// su propio módulo, importado tanto por seed.ts como por seedIafsDemo.ts.
const ANTECEDENTES_FAMILIARES = [
    'Asma', 'HTA', 'Diabetes', 'Dislipidemia', 'IAM', 'Cardiopatía isquémica',
    'ACV isquémico', 'ACV hemorrágico', 'Cáncer de colon', 'Cáncer de pulmón',
    'Cáncer de mama', 'Cáncer de ovario', 'Cáncer de próstata', 'Cáncer de riñón',
    'Enfermedades autoinmunes', 'Enfermedad tiroidea',
];
const ANTECEDENTES_PERSONALES = [
    'HIV/SIDA', 'Uso de antihipertensivos', 'HTA', 'Dislipidemia', 'IAM',
    'Enfermedad coronaria (sin IAM)', 'Arritmia', 'Aneurisma de aorta abdominal',
    'Enfermedad vascular periférica', 'Insuficiencia cardíaca', 'ACV isquémico',
    'ACV hemorrágico', 'Depresión', 'Demencia', 'Institucionalización', 'Parkinson',
    'IRC', 'Cirrosis', 'HDA', 'HDB', 'Diabetes', 'Enfermedad tiroidea', 'Bocio',
    'EPOC', 'Asma', 'TEPA', 'Diátesis hemorrágica', 'Prostatismo', 'Litiasis renal',
    'Glaucoma', 'Trombosis venosa profunda', 'Cáncer de colon', 'Cáncer de pulmón',
    'Cáncer de mama', 'Cáncer de ovario', 'Cáncer de próstata', 'Cáncer de riñón',
    'Lupus eritematoso sistémico', 'Artritis reumatoidea', 'Vasculitis',
    'Tratamiento crónico con corticoides',
];
const PROCEDIMIENTOS_QUIRURGICOS = [
    'Angioplastía coronaria', 'Bypass aortocoronario', 'Esplenectomía',
    'Colecistectomía clásica', 'Colecistectomía por video', 'Apendicectomía',
    'Hernioplastia inguinal', 'Amigdalectomía', 'Hemorroidectomía', 'Cesárea',
    'Histerectomía', 'Trasplante',
];
const ALERGIAS_CATALOGO = [
    'Penicilina', 'Iodo', 'Dipirona', 'Aspirina', 'Sulfamidas',
    'Látex', 'Anestésicos locales', 'AINES (antiinflamatorios no esteroideos)',
    'Cinta adhesiva / esparadrapo', 'Ácaros del polvo', 'Polen', 'Picadura de insectos',
    'Frutos secos', 'Mariscos', 'Huevo', 'Leche / lactosa',
];
async function seedCatalogoClinico() {
    const grupos = [
        { categoria: 'ANTECEDENTE_FAMILIAR', nombres: ANTECEDENTES_FAMILIARES },
        { categoria: 'ANTECEDENTE_PERSONAL', nombres: ANTECEDENTES_PERSONALES },
        { categoria: 'PROCEDIMIENTO_QUIRURGICO', nombres: PROCEDIMIENTOS_QUIRURGICOS },
        { categoria: 'ALERGIA', nombres: ALERGIAS_CATALOGO },
    ];
    for (const grupo of grupos) {
        for (let orden = 0; orden < grupo.nombres.length; orden++) {
            const nombre = grupo.nombres[orden];
            const codigo = slugify(nombre);
            // No se puede usar `upsert` con un where compuesto que incluya
            // `consultorioId: null` (Prisma no lo permite para columnas nulleables
            // en un índice único, coherente con que MySQL tampoco deduplica NULLs
            // ahí) — se resuelve a mano con findFirst + create/update.
            const existente = await prisma_1.default.catalogoClinicoItem.findFirst({
                where: { consultorioId: null, categoria: grupo.categoria, codigo },
            });
            if (existente) {
                await prisma_1.default.catalogoClinicoItem.update({ where: { id: existente.id }, data: { nombre, orden } });
            }
            else {
                await prisma_1.default.catalogoClinicoItem.create({
                    data: { categoria: grupo.categoria, codigo, nombre, orden, esSistema: true },
                });
            }
        }
    }
    console.log('Catálogo clínico sembrado');
}
//# sourceMappingURL=seedCatalogoClinico.js.map