// src/config/postgres.config.js
// PostgreSQL connection configuration with connection pooling

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'tiwater_timeseries',
  user: process.env.POSTGRES_USER || 'tiwater_user',
  password: process.env.POSTGRES_PASSWORD,
  max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'), // Close idle clients after 30 seconds
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000'), // Return an error after 2 seconds if connection cannot be established
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

// Handle pool errors
// Don't exit the process - let PM2 handle restarts if needed
// The pool will automatically try to reconnect
pool.on('error', (err, client) => {
  console.error('[PostgreSQL] ⚠️  Unexpected error on idle client:', err.message);
  console.error('[PostgreSQL] Error details:', {
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
// Only log errors, don't fail if PostgreSQL is not available yet
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.warn('[PostgreSQL] ⚠️  Connection test failed (this is OK if PostgreSQL is not set up yet):', err.message);
    console.warn('[PostgreSQL]    Run "npm run setup:postgres:local" to set up PostgreSQL locally');
  } else {
    console.log('[PostgreSQL] ✅ Connected successfully');
    console.log('[PostgreSQL] Server time:', res.rows[0].now);
  }
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostgreSQL] Query executed:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[PostgreSQL] Query error:', error.message);
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
    console.error('[PostgreSQL] A client has been checked out for more than 5 seconds!');
    console.error('[PostgreSQL] The last executed query on this client was:', client.lastQuery);
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[PostgreSQL] Closing connection pool...');
  await pool.end();
  console.log('[PostgreSQL] Connection pool closed');
});

export default pool;

