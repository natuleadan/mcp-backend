import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve .env relative to the project root (parent of src/), not cwd
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
dotenv.config({ path: envPath, override: true });

export const config = {
  postgresUrl: process.env.POSTGRES_URL || process.env.DB_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  icebergToken: process.env.ICEBERG_TOKEN || process.env.SUPABASE_SERVICE_ROLE_JWT || "",
  // Iceberg / Data Lake
  catalogUri: process.env.CATALOG_URI || "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  s3Endpoint: process.env.S3_ENDPOINT || "",
  icebergWarehouse: process.env.ICEBERG_WAREHOUSE || "nla-audit-lake",
  icebergNamespace: process.env.ICEBERG_NAMESPACE || "audit",
  baseDir: path.resolve(__dirname, "../base"),
  dataDir: path.resolve(__dirname, "../data"),
  bucketsDir: path.resolve(__dirname, "../buckets"),
};

if (!config.postgresUrl) {
  console.error("⚠️  POSTGRES_URL not set — DB tools will fail until configured");
}
