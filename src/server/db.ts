import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env["DATABASE_URL"] ?? "postgresql://fleetops:fleetops@localhost:5432/fleetops",
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}

export { pool };
