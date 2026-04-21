// Nygard Ch 18 p.319 — fail-fast schema/app version check.
//
// Every schema migration bumps this constant AND writes the same value
// to the _schema_version row (see scripts/add-schema-version.ts). The
// app checks the two against each other at runtime; if they diverge
// the deploy went out ahead of (or behind) its migration.
//
// We deliberately do NOT throw on mismatch. Nygard's Fail Fast targets
// process start; here the process is already a warm Lambda handler and
// crashing it would take healthy routes with it. Instead we log a
// structured event and surface the mismatch in /api/health so Better
// Stack pages the operator.
import { prisma } from "./db";
import { logger } from "./logger";

export const EXPECTED_SCHEMA_VERSION = 1;

export type SchemaVersionCheck =
  | { match: true; expected: number; actual: number }
  | { match: false; expected: number; actual: number | null; reason: "mismatch" | "table_missing" | "row_missing" | "query_failed" };

export async function checkSchemaVersion(): Promise<SchemaVersionCheck> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ version: number }>>(
      `SELECT "version" FROM "_schema_version" WHERE "id" = 1`,
    );
    if (rows.length === 0) {
      logger.error("Schema version row missing", {
        event: "schema_version_row_missing",
        expected: EXPECTED_SCHEMA_VERSION,
      });
      return { match: false, expected: EXPECTED_SCHEMA_VERSION, actual: null, reason: "row_missing" };
    }
    const actual = Number(rows[0]?.version);
    if (actual !== EXPECTED_SCHEMA_VERSION) {
      logger.error("Schema version mismatch", {
        event: "schema_version_mismatch",
        expected: EXPECTED_SCHEMA_VERSION,
        actual,
      });
      return { match: false, expected: EXPECTED_SCHEMA_VERSION, actual, reason: "mismatch" };
    }
    return { match: true, expected: EXPECTED_SCHEMA_VERSION, actual };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Postgres raises 42P01 (undefined_table) when the table is absent;
    // Prisma surfaces it in the error message. We distinguish this from
    // other failures because a missing table means the Ch18 migration
    // itself has not been run yet, which is a different operator action
    // than a generic query failure.
    if (message.includes("_schema_version") && /does not exist|undefined_table|42P01/i.test(message)) {
      logger.warn("Schema version table missing", {
        event: "schema_version_table_missing",
        expected: EXPECTED_SCHEMA_VERSION,
      });
      return { match: false, expected: EXPECTED_SCHEMA_VERSION, actual: null, reason: "table_missing" };
    }
    logger.error("Schema version query failed", {
      event: "schema_version_query_failed",
      expected: EXPECTED_SCHEMA_VERSION,
      error: message,
    });
    return { match: false, expected: EXPECTED_SCHEMA_VERSION, actual: null, reason: "query_failed" };
  }
}
