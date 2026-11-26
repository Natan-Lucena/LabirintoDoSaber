// Carrega o catálogo de habilidades e a biblioteca de atividades de
// task-library/*.json no banco do DATABASE_URL.
// Uso: pnpm seed:task-library. Idempotente: cria o que falta e atualiza o que mudou.
import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  loadTaskLibraryFiles,
  seedTaskLibrary,
} from "../src/infraestructure/seed/seed-task-library";

async function main() {
  const prisma = new PrismaClient();
  try {
    const files = loadTaskLibraryFiles(path.resolve(__dirname, "..", "task-library"));
    const report = await seedTaskLibrary(prisma, files);
    for (const [name, counts] of Object.entries(report)) {
      console.log(
        `${name}: ${counts.created.length} criadas, ${counts.updated.length} atualizadas, ${counts.unchanged.length} sem mudança`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
