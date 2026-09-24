import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  database ??= new DatabaseSync(resolve(process.cwd(), "data", "hw2.sqlite"), {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });

  return database;
}
