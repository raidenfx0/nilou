import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Ensure the environment variable is loaded before trying to connect
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create the connection pool with SSL configured for cloud databases (like Supabase)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase/Render cloud connections
  }
});

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

// Export everything from the schema for easy importing elsewhere
export * from "./schema";