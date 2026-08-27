import { createSchema, createYoga } from "graphql-yoga";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolvers } from "./resolvers/index";
import { createContext } from "./context";

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, "schema.graphql"), "utf8");

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/graphql",
});

const port = Number(process.env.PORT ?? 4000);

Bun.serve({
  port,
  fetch: yoga.fetch,
});

console.log(`🚀 Document Vault API ready at http://localhost:${port}/graphql`);
