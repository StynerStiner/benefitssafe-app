import path from "node:path";
import { defineConfig } from "prisma/config";

// Load .env.local for local development
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const dbUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: dbUrl!,
  },
  migrate: {
    url: dbUrl!,
  },
});
