import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const s3 = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION || "eu-central-003",
    credentials: {
        accessKeyId: process.env.B2_KEY_ID || "",
        secretAccessKey: process.env.B2_APP_KEY || "",
    },
    forcePathStyle: true,
});

async function test() {
    const bucket = process.env.B2_BUCKET_NAME;
    console.log(`Testing B2 deletion for bucket: ${bucket}`);

    try {
        const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
        console.log("Files in bucket:", list.Contents?.map(c => c.Key) || "Empty");

        if (list.Contents && list.Contents.length > 0) {
            const key = list.Contents[0].Key;
            console.log(`Attempting to delete: ${key}`);
            const delRes = await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            console.log("Delete response:", delRes);
            console.log("Successfully deleted (check your B2 dashboard to be sure).");
        } else {
            console.log("Bucket is empty, nothing to delete.");
        }
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
