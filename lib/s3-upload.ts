// S3 Upload Utility for Avatar and File Storage
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Sanitize a filename to prevent path traversal and injection in S3 keys.
 * Strips directory separators, null bytes, and non-alphanumeric characters
 * except dots, hyphens, and underscores.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\0/g, "")                   // strip null bytes
    .replace(/[/\\]/g, "")                // strip path separators
    .replace(/\.\./g, "")                 // strip parent directory references
    .replace(/[^a-zA-Z0-9._-]/g, "_");   // replace unsafe chars
}

export async function uploadToS3(
  file: Buffer,
  filename: string,
  folder: string = "avatars"
): Promise<string> {
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET environment variable not set");
    }

    // Sanitize filename and generate unique key
    const safeFilename = sanitizeFilename(filename);
    const uniqueFilename = `${folder}/${uuidv4()}-${safeFilename}`;

    // Resolve content type from extension (defensive — fallback to octet-stream)
    const ext = safeFilename.split(".").pop()?.toLowerCase() || "";
    const contentType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : ext === "svg" ? "image/svg+xml"
      : "application/octet-stream";

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueFilename,
      Body: file,
      ContentType: contentType,
      // No ACL — buckets with "Block Public Access" enabled reject per-object ACLs.
      // Public read access must be configured at the bucket-policy level instead
      // (recommended setup: bucket policy allowing s3:GetObject on avatars/* prefix).
    });

    await s3Client.send(command);

    // Construct public URL. Prefer explicit AWS_S3_BUCKET_URL (e.g. CloudFront distro),
    // otherwise build the region-aware virtual-hosted–style URL.
    const region = process.env.AWS_REGION || "us-east-1";
    const defaultUrl = region === "us-east-1"
      ? `https://${bucket}.s3.amazonaws.com`
      : `https://${bucket}.s3.${region}.amazonaws.com`;
    const bucketUrl = process.env.AWS_S3_BUCKET_URL || defaultUrl;
    const publicUrl = `${bucketUrl}/${uniqueFilename}`;

    return publicUrl;
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new Error("Failed to upload file to S3");
  }
}

export async function uploadAvatarToS3(
  file: Buffer,
  userId: string,
  originalFilename: string
): Promise<string> {
  const ext = originalFilename.split(".").pop() || "jpg";
  const filename = `${userId}-${Date.now()}.${ext}`;
  return uploadToS3(file, filename, "avatars");
}

export async function uploadOrgLogoToS3(
  file: Buffer,
  organizationId: string,
  originalFilename: string
): Promise<string> {
  const ext = originalFilename.split(".").pop() || "png";
  const filename = `${organizationId}-${Date.now()}.${ext}`;
  return uploadToS3(file, filename, "org-logos");
}

/**
 * Upload a document scoped to an organization.
 *
 * Key layout:
 *   Legacy (pre-org-namespace): documents/{uuid}-{entityId}-{ts}.{ext}
 *   New    (post-org-namespace): documents/{orgId}/{uuid}-{entityId}-{ts}.{ext}
 *
 * Existing documents are NOT migrated — both layouts are served by the
 * same bucket. A bucket policy that grants pre-signed URL access scoped
 * to `documents/${orgId}/*` will only protect new uploads; legacy
 * objects under `documents/*` need a separate bucket policy or a lazy
 * background re-key job.
 *
 * The org prefix exists so that even if signed URLs aren't strictly
 * enforced, an authenticated user from org A cannot guess org B's
 * document URL pattern — every key carries the owning org id as a
 * structural prefix.
 */
export async function uploadDocumentToS3(
  file: Buffer,
  organizationId: string,
  entityId: string,
  originalFilename: string,
  fileType: string = "application/pdf"
): Promise<string> {
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET environment variable not set");
    }

    const rawExt = originalFilename.split(".").pop() || "pdf";
    const ext = sanitizeFilename(rawExt);
    const safeOrgId = sanitizeFilename(organizationId);
    const uniqueFilename = `documents/${safeOrgId}/${uuidv4()}-${sanitizeFilename(entityId)}-${Date.now()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueFilename,
      Body: file,
      ContentType: fileType,
      // Documents contain sensitive financial/PII data — use private ACL
      // Access should be granted via pre-signed URLs with short TTL
      ACL: "private",
      ServerSideEncryption: "AES256",
    });

    await s3Client.send(command);

    // Return public URL
    const bucketUrl = process.env.AWS_S3_BUCKET_URL || `https://${bucket}.s3.amazonaws.com`;
    const publicUrl = `${bucketUrl}/${uniqueFilename}`;

    return publicUrl;
  } catch (error) {
    console.error("S3 document upload error:", error);
    throw new Error("Failed to upload document to S3");
  }
}
