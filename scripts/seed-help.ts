// Carrega os tutoriais de help/tutorials.json no banco do DATABASE_URL.
// Uso: pnpm seed:help. Idempotente: cria o que falta, atualiza o que mudou e
// apaga o que saiu do arquivo.
import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { loadHelpTutorials, seedHelpTutorials } from "../src/infraestructure/seed/seed-help";

async function main() {
  const prisma = new PrismaClient();
  try {
    const content = loadHelpTutorials(path.resolve(__dirname, "..", "help"));
    const report = await seedHelpTutorials(prisma, content);
    console.log(
      `tutoriais: ${report.created.length} criados, ${report.updated.length} atualizados, ${report.unchanged.length} sem mudança, ${report.removed.length} removidos`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
