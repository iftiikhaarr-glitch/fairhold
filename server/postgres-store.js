// Durable database repository. Each request transaction uses one client;
// advisory locks coordinate rental decisions across processes, not just tabs.
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";

export async function createPostgresStore({ connectionString }) {
  if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL storage");
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  // No connection string or credentials in logs. A failed idle connection is
  // discarded by pg; subsequent operations acquire a fresh client.
  pool.on("error", () => console.error("Database connection interrupted; the next request will reconnect."));
  const context = new AsyncLocalStorage();
  const query = (sql, values) => (context.getStore() || pool).query(sql, values);

  async function transaction(operation) {
    if (context.getStore()) return operation();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await context.run(client, operation);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* original error wins */ }
      throw error;
    } finally { client.release(); }
  }

  try {
    await transaction(async () => {
      await query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["fairhold:schema:v1"]);
      await query(`CREATE TABLE IF NOT EXISTS fairhold_rentals (
        id TEXT PRIMARY KEY, payload JSONB NOT NULL
      )`);
      await query(`CREATE TABLE IF NOT EXISTS fairhold_events (
        sequence BIGSERIAL PRIMARY KEY, id TEXT UNIQUE NOT NULL,
        rental_id TEXT NOT NULL REFERENCES fairhold_rentals(id) ON DELETE CASCADE,
        payload JSONB NOT NULL
      )`);
      await query("CREATE INDEX IF NOT EXISTS fairhold_events_rental ON fairhold_events(rental_id, sequence)");
      await query(`CREATE TABLE IF NOT EXISTS fairhold_idempotency (
        scope TEXT NOT NULL, request_key TEXT NOT NULL, payload JSONB NOT NULL,
        PRIMARY KEY (scope, request_key)
      )`);
    });
  } catch (error) { await pool.end(); throw error; }

  return {
    mode: "postgres",
    transaction,
    async withRentalLock(id, operation) {
      return transaction(async () => {
        const result = await query("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked", [`fairhold:rental:${id}`]);
        if (!result.rows[0].locked) {
          const error = new Error("Another operation is running for this rental. Wait, then refresh.");
          error.status = 409;
          error.code = "OPERATION_IN_PROGRESS";
          throw error;
        }
        return operation();
      });
    },
    async listRentals() {
      return (await query("SELECT payload FROM fairhold_rentals ORDER BY id")).rows.map(row => row.payload);
    },
    async findRental(id) {
      return (await query("SELECT payload FROM fairhold_rentals WHERE id=$1", [id])).rows[0]?.payload || null;
    },
    async saveRental(rental) {
      await query("INSERT INTO fairhold_rentals(id,payload) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload", [rental.id, JSON.stringify(rental)]);
      return rental;
    },
    async appendEvent(event) {
      await query("INSERT INTO fairhold_events(id,rental_id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING", [event.id, event.rentalId, JSON.stringify(event)]);
      return event;
    },
    async eventsFor(id) {
      return (await query("SELECT payload FROM fairhold_events WHERE rental_id=$1 ORDER BY sequence", [id])).rows.map(row => row.payload);
    },
    async idempotencyGet(scope, key) {
      return (await query("SELECT payload FROM fairhold_idempotency WHERE scope=$1 AND request_key=$2", [scope, key])).rows[0]?.payload || null;
    },
    async idempotencySet(scope, key, value) {
      await query("INSERT INTO fairhold_idempotency(scope,request_key,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(scope,request_key) DO NOTHING", [scope, key, JSON.stringify(value)]);
    },
    close: () => pool.end(),
  };
}
