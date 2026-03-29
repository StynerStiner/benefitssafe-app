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

    // Generate unique key
    const uniqueFilename = `${folder}/${uuidv4()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueFilename,
      Body: file,
      ContentType: `image/${filename.split(".").pop()}`,
      ACL: "public-read", // Make publicly readable
    });

    await s3Client.send(command);

    // Return public URL
    const bucketUrl = process.env.AWS_S3_BUCKET_URL || `https://${bucket}.s3.amazonaws.com`;
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

export async function uploadDocumentToS3(
  file: Buffer,
  entityId: string,
  originalFilename: string,
  fileType: string = "application/pdf"
): Promise<string> {
  try {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET environment variable not set");
    }

    // Generate unique key for document
    const ext = originalFilename.split(".").pop() || "pdf";
    const uniqueFilename = `documents/${uuidv4()}-${entityId}-${Date.now()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueFilename,
      Body: file,
      ContentType: fileType,
      ACL: "public-read",
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
