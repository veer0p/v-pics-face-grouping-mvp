import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function mustEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

let _client: S3Client | null = null;

export function getClient(): S3Client {
    if (!_client) {
        _client = new S3Client({
            endpoint: mustEnv("B2_ENDPOINT"),
            region: process.env.B2_REGION || "eu-central-003",
            credentials: {
                accessKeyId: mustEnv("B2_KEY_ID"),
                secretAccessKey: mustEnv("B2_APP_KEY"),
            },
            forcePathStyle: true, // Required for B2 S3-compatible API
        });
    }
    return _client;
}

export function getBucket(): string {
    return mustEnv("B2_BUCKET_NAME");
}

/**
 * Generate a presigned PUT URL for uploading a file to B2.
 */
export async function getUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300, // 5 minutes
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: contentType,
    });
    return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Generate a presigned GET URL for reading a file from B2.
 */
export async function getReadUrl(
    key: string,
    expiresIn = 3600, // 1 hour
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
    });
    return getSignedUrl(getClient(), command, { expiresIn });
}
