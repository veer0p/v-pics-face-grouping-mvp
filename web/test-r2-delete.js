import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function normalizeEndpoint(raw) {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
}

const s3 = new S3Client({
    endpoint: normalizeEndpoint(process.env.R2_ENDPOINT || ""),
    region: process.env.R2_REGION || "auto",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true,
});

async function test() {
    const bucket = process.env.R2_BUCKET_NAME;
    console.log(`Testing R2 deletion for bucket: ${bucket}`);

    try {
        const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
        console.log("Files in bucket:", list.Contents?.map((c) => c.Key) || "Empty");

        if (list.Contents && list.Contents.length > 0) {
            const key = list.Contents[0].Key;
            console.log(`Attempting to delete: ${key}`);
            const delRes = await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            console.log("Delete response:", delRes);
            console.log("Successfully deleted (check your R2 dashboard to be sure).");
        } else {
            console.log("Bucket is empty, nothing to delete.");
        }
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
