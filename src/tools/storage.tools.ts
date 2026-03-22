import { z } from "zod";
import { getSupabase } from "../supabase.js";
import { config } from "../config.js";
import fs from "node:fs";
import path from "node:path";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
  ".json": "application/json", ".txt": "text/plain", ".csv": "text/csv",
};

export const storageTools = [
  {
    name: "list_buckets",
    description: "List all Supabase storage buckets with their visibility",
    inputSchema: z.object({}),
    handler: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(error.message);
      return JSON.stringify(data.map((b: { id: string; name: string; public: boolean }) => ({ id: b.id, name: b.name, public: b.public })), null, 2);
    },
  },

  {
    name: "list_files",
    description: "List files in a bucket folder",
    inputSchema: z.object({
      bucket: z.string().describe("Bucket name"),
      folder: z.string().optional().describe("Folder path (empty = root)"),
      limit: z.coerce.number().int().min(1).max(500).default(50),
    }),
    handler: async ({ bucket, folder, limit }: { bucket: string; folder?: string; limit: number }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage.from(bucket).list(folder ?? "", { limit });
      if (error) throw new Error(error.message);
      return JSON.stringify(data.map(f => ({ name: f.name, size: f.metadata?.size, updated: f.updated_at })), null, 2);
    },
  },

  {
    name: "upload_file",
    description: "Upload any local file to a Supabase storage bucket. local_path can be absolute (/Users/...) or relative to buckets/{bucket}/",
    inputSchema: z.object({
      bucket: z.string().describe("Bucket name"),
      local_path: z.string().describe("File path — absolute (/Users/leo/logo.svg) or relative to buckets/{bucket}/ (images/logo.svg)"),
      storage_path: z.string().describe("Destination path inside the bucket (e.g. 'branding/logo.svg')"),
      upsert: z.boolean().default(true),
    }),
    handler: async ({ bucket, local_path, storage_path, upsert }: { bucket: string; local_path: string; storage_path: string; upsert: boolean }) => {
      const fullPath = path.isAbsolute(local_path)
        ? local_path
        : path.join(config.bucketsDir, bucket, local_path);
      if (!fs.existsSync(fullPath)) return `❌ File not found: ${fullPath}`;
      const fileBuffer = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_MAP[ext] ?? "application/octet-stream";
      const supabase = getSupabase();
      const { data, error } = await supabase.storage.from(bucket).upload(storage_path, fileBuffer, { contentType, upsert });
      if (error) throw new Error(error.message);
      return `✅ Uploaded → ${bucket}/${data.path}`;
    },
  },

  {
    name: "delete_file",
    description: "Delete a file from a Supabase storage bucket",
    inputSchema: z.object({
      bucket: z.string().describe("Bucket name"),
      path: z.string().describe("File path in the bucket"),
    }),
    handler: async ({ bucket, path: filePath }: { bucket: string; path: string }) => {
      const supabase = getSupabase();
      const { error } = await supabase.storage.from(bucket).remove([filePath]);
      if (error) throw new Error(error.message);
      return `✅ Deleted: ${bucket}/${filePath}`;
    },
  },

  {
    name: "get_signed_url",
    description: "Generate a signed URL for a private bucket file",
    inputSchema: z.object({
      bucket: z.string().describe("Bucket name"),
      path: z.string().describe("File path in the bucket"),
      expires_in: z.coerce.number().int().default(3600).describe("Expiry in seconds"),
    }),
    handler: async ({ bucket, path: filePath, expires_in }: { bucket: string; path: string; expires_in: number }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expires_in);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  },

  {
    name: "get_public_url",
    description: "Get the public URL for a file in a public bucket",
    inputSchema: z.object({
      bucket: z.string().describe("Bucket name (must be public)"),
      path: z.string().describe("File path in the bucket"),
    }),
    handler: async ({ bucket, path: filePath }: { bucket: string; path: string }) => {
      const supabase = getSupabase();
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    },
  },

  {
    name: "sync_bucket",
    description: "Download files from Supabase storage to local buckets/ folder. Can sync all buckets, one bucket, a specific folder, or a single file.",
    inputSchema: z.object({
      bucket: z.string().optional().describe("Bucket to sync — omit to sync ALL buckets"),
      folder: z.string().optional().describe("Folder path to sync (e.g. 'branding/logos') — requires bucket"),
      file: z.string().optional().describe("Single file path to download (e.g. 'branding/logo.svg') — requires bucket"),
      limit: z.coerce.number().int().min(1).max(1000).default(200),
    }),
    handler: async ({ bucket, folder, file, limit }: { bucket?: string; folder?: string; file?: string; limit: number }) => {
      const supabase = getSupabase();
      const results: string[] = [];

      async function downloadFile(bkt: string, filePath: string) {
        const { data, error } = await supabase.storage.from(bkt).download(filePath);
        if (error) {
          results.push(`❌ ${bkt}/${filePath}: ${error.message}`);
          return;
        }
        const localPath = path.join(config.bucketsDir, bkt, filePath);
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(localPath, buffer);
        results.push(`✅ ${bkt}/${filePath}`);
      }

      async function syncFolder(bkt: string, folderPath: string) {
        const { data, error } = await supabase.storage.from(bkt).list(folderPath, { limit });
        if (error) { results.push(`❌ list ${bkt}/${folderPath}: ${error.message}`); return; }
        for (const item of data ?? []) {
          const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          if (item.id === null) {
            await syncFolder(bkt, itemPath); // it's a folder
          } else {
            await downloadFile(bkt, itemPath);
          }
        }
      }

      if (file && bucket) {
        await downloadFile(bucket, file);
      } else if (bucket) {
        await syncFolder(bucket, folder ?? "");
      } else {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) return `❌ ${error.message}`;
        for (const b of buckets ?? []) {
          await syncFolder(b.id, "");
        }
      }

      return `Sync complete (${results.length} files):\n${results.join("\n")}`;
    },
  },
];
