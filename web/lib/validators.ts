import { z } from "zod";

export const MAX_FILES_PER_JOB = 30;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const uploadFileInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(200),
  size: z.number().int().nonnegative().max(MAX_FILE_BYTES),
});

export const jobConfigSchema = z
  .object({
    eps: z.number().min(0.05).max(1).optional(),
    minSamples: z.number().int().min(1).max(20).optional(),
    minDetScore: z.number().min(0).max(1).optional(),
  })
  .default({});

export const initUploadSchema = z.object({
  files: z.array(uploadFileInputSchema).min(1).max(MAX_FILES_PER_JOB),
  config: jobConfigSchema.optional(),
});

export const completeUploadSchema = z.object({
  jobId: z.string().uuid(),
  objectPaths: z.array(z.string().trim().min(1)).min(1).max(MAX_FILES_PER_JOB),
});

export function parseInitUploadPayload(value: unknown) {
  return initUploadSchema.safeParse(value);
}

export function parseCompleteUploadPayload(value: unknown) {
  return completeUploadSchema.safeParse(value);
}
