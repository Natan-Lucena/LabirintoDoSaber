// PP-10: toda rota registrada nos routers está no Swagger com o mesmo método
// e caminho, e o Swagger não documenta rota que não existe. As rotas saem dos
// arquivos de rota (sem importar os routers, que instanciam Prisma e serviços).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = __dirname;
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

// Jobs internos chamados pelo cron da Vercel, protegidos por segredo.
const NOT_DOCUMENTED = new Set([
  "GET /notification/cron",
  "POST /notification/cron",
  "GET /appointment/watchdog",
  "POST /appointment/watchdog",
]);

const read = (path: string) => readFileSync(join(SRC, path), "utf-8");

// Express ":id" → OpenAPI "{id}", sem barra no fim.
const toOpenApi = (path: string) =>
  path.replace(/:(\w+)/g, "{$1}").replace(/\/+$/, "") || "/";

interface RouteScan {
  // Router importado de um módulo → nome do módulo.
  imported: Map<string, string>;
  // Routers montados em application/routes/index.ts, na ordem.
  mounted: string[];
  // Chamadas router.use( no arquivo principal, lidas ou não.
  useCalls: number;
  // Rotas por módulo, "MÉTODO /caminho".
  routesByModule: Map<string, string[]>;
  // Arquivos com chamada de método sem caminho literal ou com .route(.
  unreadable: string[];
}

// Caminho entre aspas duplas, simples ou crase.
const QUOTED = String.raw`["'\x60]([^"'\x60]+)["'\x60]`;

function scanRoutes(): RouteScan {
  const main = read("application/routes/index.ts");
  const imported = new Map(
    [
      ...main.matchAll(
        /import\s*\{\s*(\w+)\s*\}\s*from\s*["']\.\.\/modules\/([\w-]+)\/routes(?:\/index)?["']/g
      ),
    ].map(([, router, module]) => [router, module])
  );

  // router.use("/prefixo", middleware..., moduloRouter); o router é o último argumento.
  const useCalls = main.match(/\brouter\.use\(/g)?.length ?? 0;
  const mounts = [
    ...main.matchAll(new RegExp(String.raw`\brouter\.use\(\s*${QUOTED}\s*,([^;]*?)\)\s*;`, "g")),
  ].map(([, prefix, args]) => ({ prefix, router: args.split(",").pop()!.trim() }));

  const unreadable: string[] = [];
  if (/\.route\(/.test(main)) unreadable.push("application/routes/index.ts: .route(");

  const routesByModule = new Map<string, string[]>();
  for (const { prefix, router } of mounts) {
    const module = imported.get(router);
    if (!module) {
      unreadable.push(`router montado sem import de módulo: ${router}`);
      continue;
    }
    const file = `application/modules/${module}/routes/index.ts`;
    const source = read(file);
    if (/\.route\(/.test(source)) unreadable.push(`${file}: .route(`);

    // Toda chamada de método precisa ter o caminho literal para ser lida aqui.
    const methods = METHODS.join("|");
    const calls =
      source.match(new RegExp(String.raw`\b${router}\.(${methods})\(`, "g"))?.length ?? 0;
    const literal = [
      ...source.matchAll(new RegExp(String.raw`\b${router}\.(${methods})\(\s*${QUOTED}`, "g")),
    ];
    if (literal.length !== calls) unreadable.push(`${file}: rota sem caminho literal`);

    const routes = routesByModule.get(module) ?? [];
    for (const [, method, path] of literal) {
      routes.push(`${method.toUpperCase()} ${toOpenApi(prefix + path)}`);
    }
    routesByModule.set(module, routes);
  }

  return {
    imported,
    mounted: mounts.map((mount) => mount.router),
    useCalls,
    routesByModule,
    unreadable,
  };
}

const swagger = JSON.parse(read("swagger.json"));

function documentedRoutes(): string[] {
  return Object.entries(swagger.paths as Record<string, Record<string, unknown>>).flatMap(
    ([path, operations]) =>
      Object.keys(operations)
        .filter((method) => (METHODS as readonly string[]).includes(method))
        .map((method) => `${method.toUpperCase()} ${toOpenApi(path)}`)
  );
}

describe("swagger.json (PP-10)", () => {
  const scan = scanRoutes();
  const registered = [...scan.routesByModule.values()].flat();
  const documented = documentedRoutes();

  it("should mount and read every imported router", () => {
    expect(scan.imported.size).toBeGreaterThan(0);
    expect(scan.mounted).toHaveLength(scan.useCalls);
    expect(scan.mounted).toHaveLength(scan.imported.size);
    expect([...scan.mounted].sort()).toEqual([...scan.imported.keys()].sort());
    expect(scan.unreadable).toEqual([]);
  });

  it("should find at least one route in each module", () => {
    expect([...scan.routesByModule.keys()].sort()).toEqual([...scan.imported.values()].sort());
    for (const [module, routes] of scan.routesByModule) {
      expect(routes.length, module).toBeGreaterThan(0);
    }
  });

  it("should read the routes of every mounted module", () => {
    expect(registered.length).toBeGreaterThan(100);
    expect(registered).toContain("GET /task/{id}");
    expect(registered).toContain("POST /anamnese/templates/{templateId}/responses");
  });

  it("should document every registered route, except the internal jobs", () => {
    const missing = registered.filter(
      (route) => !NOT_DOCUMENTED.has(route) && !documented.includes(route)
    );
    expect(missing).toEqual([]);
  });

  it("should not document routes that do not exist", () => {
    expect(documented.filter((route) => !registered.includes(route))).toEqual([]);
  });

  it("should keep the exceptions list up to date", () => {
    for (const route of NOT_DOCUMENTED) expect(registered).toContain(route);
    expect(documented.filter((route) => NOT_DOCUMENTED.has(route))).toEqual([]);
  });

  it("should declare every path parameter of each operation", () => {
    const resolve = (item: any) =>
      item.$ref
        ? item.$ref
            .split("/")
            .slice(1)
            .reduce((node: any, key: string) => node[key], swagger)
        : item;

    const mismatches: string[] = [];
    for (const [path, operations] of Object.entries<any>(swagger.paths)) {
      const expected = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
      const shared = (operations.parameters ?? []).map(resolve);
      for (const method of METHODS) {
        const operation = operations[method];
        if (!operation) continue;
        const declared = [...shared, ...(operation.parameters ?? []).map(resolve)]
          .filter((parameter: any) => parameter.in === "path")
          .map((parameter: any) => parameter.name)
          .sort();
        if (JSON.stringify(declared) !== JSON.stringify(expected)) {
          mismatches.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("should resolve every internal $ref", () => {
    const refs = [...JSON.stringify(swagger).matchAll(/"\$ref":"#\/([^"]+)"/g)].map(
      ([, ref]) => ref
    );
    const broken = [...new Set(refs)].filter(
      (ref) =>
        ref.split("/").reduce((node: any, key: string) => node?.[key], swagger) === undefined
    );
    expect(broken).toEqual([]);
  });
});
