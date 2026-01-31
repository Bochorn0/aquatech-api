// src/config/postgres-tiwater.config.js
// PostgreSQL connection configuration for TI_water database (separate from timeseries)
// This database is specifically for the quotes/products system

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool for TI_water database
const pool = new Pool({
  host: process.env.POSTGRES_TIWATER_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_TIWATER_PORT || process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_TIWATER_DB || 'ti_water',
  user: process.env.POSTGRES_TIWATER_USER || process.env.POSTGRES_USER || 'tiwater_user',
  password: process.env.POSTGRES_TIWATER_PASSWORD || process.env.POSTGRES_PASSWORD,
  max: parseInt(process.env.POSTGRES_TIWATER_MAX_CONNECTIONS || process.env.POSTGRES_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: parseInt(process.env.POSTGRES_TIWATER_IDLE_TIMEOUT || process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_TIWATER_CONNECTION_TIMEOUT || process.env.POSTGRES_CONNECTION_TIMEOUT || '2000'),
  ssl: process.env.POSTGRES_TIWATER_SSL === 'true' || process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

// Handle pool errors
// Don't exit the process - let PM2 handle restarts if needed
// The pool will automatically try to reconnect
pool.on('error', (err, client) => {
  console.error('[PostgreSQL TI_water] ⚠️  Unexpected error on idle client:', err.message);
  console.error('[PostgreSQL TI_water] Error details:', {
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    address: err.address,
    port: err.port
  });
  // Don't exit - let the application continue and the pool will handle reconnection
  // PM2 will restart if there's a fatal error, but connection errors should be handled gracefully
});

// Test connection on startup (non-blocking)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.warn('[PostgreSQL TI_water] ⚠️  Connection test failed (this is OK if PostgreSQL is not set up yet):', err.message);
    console.warn('[PostgreSQL TI_water]    Database name:', process.env.POSTGRES_TIWATER_DB || 'ti_water');
  } else {
    console.log('[PostgreSQL TI_water] ✅ Connected successfully');
    console.log('[PostgreSQL TI_water] Server time:', res.rows[0].now);
  }
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostgreSQL TI_water] Query executed:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[PostgreSQL TI_water] Query error:', error.message);
    throw error;
  }
};

// Helper function to get a client from the pool (for transactions)
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('[PostgreSQL TI_water] A client has been checked out for more than 5 seconds!');
    console.error('[PostgreSQL TI_water] The last executed query on this client was:', client.lastQuery);
  }, 5000);
  
  // Monkey patch the query method to log the last query
  client.query = (...args) => {
    client.lastQuery = args;
    return query(...args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };
  
  return client;
};

// Graceful shutdown (SIGINT = Ctrl+C, SIGTERM = PM2/systemd kill)
const closePool = async () => {
  console.log('[PostgreSQL TI_water] Closing connection pool...');
  await pool.end();
  console.log('[PostgreSQL TI_water] Connection pool closed');
};
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

export default pool;
