import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function mustEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

function normalizeEndpoint(raw: string): string {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error("R2_ENDPOINT must be a valid URL");
    }

    // Accept accidental bucket suffixes like https://<account>.r2.cloudflarestorage.com/<bucket>
    // and normalize to the account endpoint.
    return `${parsed.protocol}//${parsed.host}`;
}

let _client: S3Client | null = null;

export function getClient(): S3Client {
    if (!_client) {
        _client = new S3Client({
            endpoint: normalizeEndpoint(mustEnv("R2_ENDPOINT")),
            region: process.env.R2_REGION || "auto",
            credentials: {
                accessKeyId: mustEnv("R2_ACCESS_KEY_ID"),
                secretAccessKey: mustEnv("R2_SECRET_ACCESS_KEY"),
            },
            forcePathStyle: true,
        });
    }
    return _client;
}

export function getBucket(): string {
    return mustEnv("R2_BUCKET_NAME");
}

/**
 * Generate a presigned PUT URL for uploading a file to R2.
 */
export async function getUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: contentType,
    });
    return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Generate a presigned GET URL for reading a file from R2.
 */
export async function getReadUrl(
    key: string,
    expiresIn = 3600,
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
    });
    return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
    });
    await getClient().send(command);
}
