import { config } from './config.js'
import { getSupabase } from './supabase.js'
import * as Minio from 'minio'

export type BucketInfo = { id: string; name: string; public: boolean }
export type FileInfo = { name: string; size?: number; updated?: string }

export interface StorageProvider {
  listBuckets(): Promise<BucketInfo[]>
  listFiles(bucket: string, folder?: string, limit?: number): Promise<FileInfo[]>
  uploadFile(bucket: string, path: string, buffer: Buffer, contentType: string, upsert?: boolean): Promise<string>
  deleteFile(bucket: string, path: string): Promise<void>
  getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string>
  getPublicUrl(bucket: string, path: string): string
  downloadFile(bucket: string, path: string): Promise<Buffer>
  createBucket(name: string, isPublic: boolean, allowedMimeTypes?: string[], fileSizeLimit?: number): Promise<void>
  deleteBucket(name: string): Promise<void>
  emptyBucket(name: string): Promise<void>
  updateBucket(name: string, isPublic: boolean, allowedMimeTypes?: string[], fileSizeLimit?: number): Promise<void>
}

class SupabaseStorage implements StorageProvider {
  private get client() {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase not configured — set SUPABASE_URL and SUPABASE_SECRET_KEY')
    return sb.storage
  }

  async listBuckets(): Promise<BucketInfo[]> {
    const { data, error } = await this.client.listBuckets()
    if (error) throw new Error(error.message)
    return (data ?? []).map(b => ({ id: b.id, name: b.name, public: b.public }))
  }

  async listFiles(bucket: string, folder?: string, limit = 200): Promise<FileInfo[]> {
    const { data, error } = await this.client.from(bucket).list(folder ?? '', { limit })
    if (error) throw new Error(error.message)
    return (data ?? []).map(f => ({ name: f.name, size: f.metadata?.size, updated: f.updated_at ?? undefined }))
  }

  async uploadFile(bucket: string, path: string, buffer: Buffer, contentType: string, upsert = true): Promise<string> {
    const { data, error } = await this.client.from(bucket).upload(path, buffer, { contentType, upsert })
    if (error) throw new Error(error.message)
    return data.path
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.from(bucket).remove([path])
    if (error) throw new Error(error.message)
  }

  async getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string> {
    const { data, error } = await this.client.from(bucket).createSignedUrl(path, expiresIn)
    if (error) throw new Error(error.message)
    return data.signedUrl
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.client.from(bucket).download(path)
    if (error) throw new Error(error.message)
    return Buffer.from(await data.arrayBuffer())
  }

  async createBucket(name: string, isPublic: boolean, allowedMimeTypes?: string[], fileSizeLimit?: number): Promise<void> {
    const { error } = await this.client.createBucket(name, { public: isPublic, allowedMimeTypes, fileSizeLimit })
    if (error) throw new Error(error.message)
  }

  async deleteBucket(name: string): Promise<void> {
    const { error } = await this.client.deleteBucket(name)
    if (error) throw new Error(error.message)
  }

  async emptyBucket(name: string): Promise<void> {
    const { error } = await this.client.emptyBucket(name)
    if (error) throw new Error(error.message)
  }

  async updateBucket(name: string, isPublic: boolean, allowedMimeTypes?: string[], fileSizeLimit?: number): Promise<void> {
    const { error } = await this.client.updateBucket(name, { public: isPublic, allowedMimeTypes, fileSizeLimit })
    if (error) throw new Error(error.message)
  }
}

class S3Storage implements StorageProvider {
  private client: Minio.Client

  constructor() {
    const url = new URL(config.storageEndpointUrl)
    this.client = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port, 10) : undefined,
      useSSL: url.protocol === 'https:',
      accessKey: config.storageAccessKeyId,
      secretKey: config.storageSecretAccessKey,
      region: config.storageRegion,
    })
  }

  async listBuckets(): Promise<BucketInfo[]> {
    const buckets = await this.client.listBuckets()
    return buckets.map(b => ({ id: b.name, name: b.name, public: true }))
  }

  async listFiles(bucket: string, folder?: string, limit = 200): Promise<FileInfo[]> {
    const prefix = folder ? (folder.endsWith('/') ? folder : `${folder}/`) : ''
    const stream = this.client.listObjects(bucket, prefix, true)
    const files: FileInfo[] = []
    for await (const obj of stream) {
      if (files.length >= limit) break
      if (obj.name) {
        const updated = obj.lastModified?.toISOString()
        files.push({ name: obj.name.slice(prefix.length) || obj.name, size: obj.size, updated: updated ?? undefined })
      }
    }
    return files
  }

  async uploadFile(bucket: string, path: string, buffer: Buffer, contentType: string, _upsert = true): Promise<string> {
    await this.client.putObject(bucket, path, buffer, buffer.length, { 'Content-Type': contentType })
    return path
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await this.client.removeObject(bucket, path)
  }

  async getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string> {
    return this.client.presignedGetObject(bucket, path, expiresIn)
  }

  getPublicUrl(bucket: string, path: string): string {
    const base = config.storageEndpointUrl.replace(/\/+$/, '')
    return `${base}/${bucket}/${path}`
  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, path)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async createBucket(name: string, isPublic: boolean): Promise<void> {
    await this.client.makeBucket(name, config.storageRegion)
    if (isPublic) {
      const policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${name}/*`],
        }],
      }
      await this.client.setBucketPolicy(name, JSON.stringify(policy))
    }
  }

  async deleteBucket(name: string): Promise<void> {
    await this.client.removeBucket(name)
  }

  async emptyBucket(name: string): Promise<void> {
    const stream = this.client.listObjects(name, '', true)
    const toDelete: string[] = []
    for await (const obj of stream) {
      if (obj.name) toDelete.push(obj.name)
    }
    if (toDelete.length > 0) {
      await this.client.removeObjects(name, toDelete)
    }
  }

  async updateBucket(name: string, isPublic: boolean): Promise<void> {
    if (isPublic) {
      const policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${name}/*`],
        }],
      }
      await this.client.setBucketPolicy(name, JSON.stringify(policy))
    } else {
      await this.client.setBucketPolicy(name, '')
    }
  }
}

let _storage: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (!_storage) {
    if (config.backendMode === 'supabase') {
      _storage = new SupabaseStorage()
    } else {
      _storage = new S3Storage()
    }
  }
  return _storage
}
