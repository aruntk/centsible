/**
 * Mobile SQLite implementation using @capacitor-community/sqlite
 * This runs client-side in the Capacitor app.
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  IDatabase,
  DbStatement,
  DbRunResult,
  DB_SCHEMA,
  DEFAULT_CATEGORIES,
  DEFAULT_RULES,
  NEW_CATEGORIES,
} from "./db-interface";

const DB_NAME = "centsible";

let _connection: SQLiteDBConnection | null = null;
let _sqlite: SQLiteConnection | null = null;

export async function initMobileDb(): Promise<MobileDatabase> {
  if (_connection) {
    return new MobileDatabase(_connection);
  }

  _sqlite = new SQLiteConnection(CapacitorSQLite);

  // Check connection consistency
  const retCC = await _sqlite.checkConnectionsConsistency();
  const isConn = (await _sqlite.isConnection(DB_NAME, false)).result;

  if (retCC.result && isConn) {
    _connection = await _sqlite.retrieveConnection(DB_NAME, false);
  } else {
    _connection = await _sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  }

  await _connection.open();

  const db = new MobileDatabase(_connection);
  await db.initSchema();

  return db;
}

export async function closeMobileDb(): Promise<void> {
  if (_connection && _sqlite) {
    await _sqlite.closeConnection(DB_NAME, false);
    _connection = null;
  }
}

class MobileDatabase implements IDatabase {
  constructor(private conn: SQLiteDBConnection) {}

  async initSchema(): Promise<void> {
    // Execute schema creation
    await this.conn.execute(DB_SCHEMA);

    // Set pragmas
    await this.conn.execute("PRAGMA foreign_keys = ON;");

    // Run migrations
    await this.runMigrations();

    // Seed defaults if needed
    await this.seedIfEmpty();
  }

  private async runMigrations(): Promise<void> {
    // Check for condition columns
    const tableInfo = await this.conn.query("PRAGMA table_info(category_rules)");
    const colNames = new Set((tableInfo.values || []).map((row) => row[1] as string));

    if (!colNames.has("condition_field")) {
      await this.conn.execute("ALTER TABLE category_rules ADD COLUMN condition_field TEXT");
      await this.conn.execute("ALTER TABLE category_rules ADD COLUMN condition_op TEXT");
      await this.conn.execute("ALTER TABLE category_rules ADD COLUMN condition_value REAL");
    }
    if (!colNames.has("condition_value2")) {
      await this.conn.execute("ALTER TABLE category_rules ADD COLUMN condition_value2 REAL");
    }

    // Seed new categories if missing
    const existingCats = await this.conn.query("SELECT name FROM categories");
    const existingNames = new Set((existingCats.values || []).map((row) => row[0] as string));

    for (const [name, color, icon] of NEW_CATEGORIES) {
      if (!existingNames.has(name)) {
        await this.conn.run(
          "INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)",
          [name, color, icon]
        );
      }
    }
  }

  private async seedIfEmpty(): Promise<void> {
    const count = await this.conn.query("SELECT COUNT(*) as c FROM categories");
    const c = (count.values?.[0]?.[0] as number) || 0;

    if (c === 0) {
      await this.seedDefaults();
    }
  }

  private async seedDefaults(): Promise<void> {
    const catIds: Record<string, number> = {};

    for (const [name, color, icon] of DEFAULT_CATEGORIES) {
      const result = await this.conn.run(
        "INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)",
        [name, color, icon]
      );
      catIds[name] = result.changes?.lastId || 0;
    }

    for (const [catName, keyword, priority] of DEFAULT_RULES) {
      await this.conn.run(
        "INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)",
        [catIds[catName], keyword, priority]
      );
    }
  }

  exec(_sql: string): void {
    // Synchronous exec not supported - use execAsync
    throw new Error("Use execAsync for mobile database");
  }

  async execAsync(sql: string): Promise<void> {
    await this.conn.execute(sql);
  }

  prepare<T = unknown>(sql: string): DbStatement<T> {
    // Return a statement-like object that works with the mobile DB
    return new MobileStatement<T>(this.conn, sql);
  }

  transaction<T>(fn: () => T): () => T {
    // Mobile transactions are handled differently - wrap in async
    return () => {
      // For mobile, we'll handle transactions at the API level
      return fn();
    };
  }

  pragma(_pragma: string): unknown {
    // Pragmas are set during init
    return undefined;
  }

  // Async query methods for mobile
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.conn.query(sql, params);
    return this.convertRows<T>(result.values || []);
  }

  async run(sql: string, params: unknown[] = []): Promise<DbRunResult> {
    const result = await this.conn.run(sql, params);
    return {
      lastInsertRowid: result.changes?.lastId || 0,
      changes: result.changes?.changes || 0,
    };
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  private convertRows<T>(values: unknown[][]): T[] {
    // The capacitor-sqlite returns values as arrays, we need to map them to objects
    // This requires knowing the column names from the query
    return values as unknown as T[];
  }

  async beginTransaction(): Promise<void> {
    await this.conn.execute("BEGIN TRANSACTION");
  }

  async commitTransaction(): Promise<void> {
    await this.conn.execute("COMMIT");
  }

  async rollbackTransaction(): Promise<void> {
    await this.conn.execute("ROLLBACK");
  }
}

class MobileStatement<T> implements DbStatement<T> {
  constructor(
    private conn: SQLiteDBConnection,
    private sql: string
  ) {}

  run(..._params: unknown[]): DbRunResult {
    // Synchronous run not supported
    throw new Error("Use runAsync for mobile database");
  }

  get(..._params: unknown[]): T | undefined {
    // Synchronous get not supported
    throw new Error("Use getAsync for mobile database");
  }

  all(..._params: unknown[]): T[] {
    // Synchronous all not supported
    throw new Error("Use allAsync for mobile database");
  }

  // Async versions for mobile
  async runAsync(...params: unknown[]): Promise<DbRunResult> {
    const result = await this.conn.run(this.sql, params);
    return {
      lastInsertRowid: result.changes?.lastId || 0,
      changes: result.changes?.changes || 0,
    };
  }

  async getAsync(...params: unknown[]): Promise<T | undefined> {
    const result = await this.conn.query(this.sql, params);
    if (!result.values || result.values.length === 0) {
      return undefined;
    }
    return this.rowToObject(result.values[0]);
  }

  async allAsync(...params: unknown[]): Promise<T[]> {
    const result = await this.conn.query(this.sql, params);
    if (!result.values || result.values.length === 0) {
      return [];
    }
    // First row might be column names in some cases
    return result.values.map((row) => this.rowToObject(row)) as T[];
  }

  private rowToObject(row: unknown[]): T {
    // capacitor-sqlite returns column names in a separate property
    // For now, return the raw row - the API layer will handle mapping
    return row as unknown as T;
  }
}

export type { MobileDatabase };
