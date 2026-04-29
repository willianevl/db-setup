import pg from 'pg';
import mysql from 'mysql2/promise';

const PG_ERROR_MESSAGES = {
  ECONNREFUSED: ({ host, port }) => `could not connect to PostgreSQL at ${host}:${port} — is it running?`,
  '28P01':      ({ user })       => `authentication failed for user "${user}"`,
  '28000':      ({ user })       => `authentication failed for user "${user}"`,
};

const MYSQL_ERROR_MESSAGES = {
  ECONNREFUSED:         ({ host, port }) => `could not connect to MySQL at ${host}:${port} — is it running?`,
  ER_ACCESS_DENIED_ERROR: ({ user })     => `access denied for user "${user}"`,
};

async function dropAndCreatePostgres({ host, port, database, user, password }) {
  const client = new pg.Client({ host, port: Number(port) || 5432, user, password, database: 'postgres' });
  try {
    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS "${database}"`);
    await client.query(`CREATE DATABASE "${database}"`);
  } catch (err) {
    const friendlyMsg = PG_ERROR_MESSAGES[err.code]?.({ host, port, user, database });
    throw new Error(`PostgreSQL: ${friendlyMsg ?? err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function dropAndCreateMySQL({ host, port, database, user, password }) {
  let conn;
  try {
    conn = await mysql.createConnection({ host, port: Number(port) || 3306, user, password });
    await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await conn.query(`CREATE DATABASE \`${database}\``);
  } catch (err) {
    const friendlyMsg = MYSQL_ERROR_MESSAGES[err.code]?.({ host, port, user, database });
    throw new Error(`MySQL: ${friendlyMsg ?? err.message}`);
  } finally {
    await conn?.end().catch(() => {});
  }
}

export async function dropAndCreateDatabase({ host, port, database, user, password, dbType = 'postgres' }) {
  if (dbType === 'mysql') return dropAndCreateMySQL({ host, port, database, user, password });
  return dropAndCreatePostgres({ host, port, database, user, password });
}
