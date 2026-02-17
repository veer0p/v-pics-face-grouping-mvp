export type UploadFileInput = {
  name: string;
  type: string;
  size: number;
};

export type UploadDescriptor = {
  imageId: string;
  objectPath: string;
  signedUploadUrl: string;
  token: string;
};

export type InitUploadResponse = {
  jobId: string;
  uploads: UploadDescriptor[];
};

export type JobStatus = "draft" | "queued" | "processing" | "completed" | "failed";

export type JobSummary = {
  id: string;
  status: JobStatus;
  stats: Record<string, number>;
  errorMessage: string | null;
};

export type ClusterGroup = {
  clusterId: string;
  clusterLabel: number;
  faceCount: number;
  previewUrl: string | null;
};

export type FaceInGroup = {
  faceId: string;
  clusterId: string | null;
  clusterLabel: number;
  detScore: number;
  cropUrl: string | null;
  sourceImageUrl: string | null;
};

export type JobResultResponse = {
  job: JobSummary;
  groups: ClusterGroup[];
  facesByGroup: Record<string, FaceInGroup[]>;
};
