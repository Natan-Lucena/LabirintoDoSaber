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

function registeredRoutes(): string[] {
  const main = read("application/routes/index.ts");
  const moduleOf = new Map(
    [...main.matchAll(/import \{ (\w+) \} from "\.\.\/modules\/([\w-]+)\/routes"/g)].map(
      ([, router, module]) => [router, module]
    )
  );
  const mounts = [...main.matchAll(/router\.use\("([^"]+)", (\w+)\)/g)];

  const routes: string[] = [];
  for (const [, prefix, router] of mounts) {
    const module = moduleOf.get(router);
    if (!module) throw new Error(`router sem import: ${router}`);
    const source = read(`application/modules/${module}/routes/index.ts`);

    // Toda chamada de método precisa ter o caminho literal para ser lida aqui.
    const calls = source.match(new RegExp(`\\b${router}\\.(${METHODS.join("|")})\\(`, "g")) ?? [];
    const literal = [
      ...source.matchAll(
        new RegExp(`\\b${router}\\.(${METHODS.join("|")})\\(\\s*["'\`]([^"'\`]+)["'\`]`, "g")
      ),
    ];
    expect(literal.length, `${module}: rota sem caminho literal`).toBe(calls.length);

    for (const [, method, path] of literal) {
      routes.push(`${method.toUpperCase()} ${toOpenApi(prefix + path)}`);
    }
  }
  return routes;
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
  const registered = registeredRoutes();
  const documented = documentedRoutes();

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
