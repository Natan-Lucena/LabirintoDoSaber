// Carrega o catálogo de escalas de scales/*.json no banco do DATABASE_URL.
// Uso: pnpm seed:scales. Idempotente; versão publicada com conteúdo diferente aborta.
import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { loadScaleFiles, seedScales } from "../src/infraestructure/seed/seed-scales";

async function main() {
  const prisma = new PrismaClient();
  try {
    const files = loadScaleFiles(path.resolve(__dirname, "..", "scales"));
    const report = await seedScales(prisma, files);
    console.log(`Escalas criadas: ${report.created.join(", ") || "nenhuma"}`);
    console.log(`Escalas sem mudança: ${report.unchanged.join(", ") || "nenhuma"}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
