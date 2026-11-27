import {
  FileStorage,
  ISaveFileRequest,
  ISaveFileResponse,
} from "../../application/services/file-storage";
import * as AWS from "aws-sdk";

// O `Location` do upload vem no estilo virtual-hosted
// (https://<bucket>.s3[.<região>].amazonaws.com/<chave>); aceitamos também o
// estilo de caminho (https://s3[.<região>].amazonaws.com/<bucket>/<chave>).
export function isBucketUrl(url: string, bucket: string, region?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const name = bucket.toLowerCase();
  const regional = region ? [`s3.${region}.amazonaws.com`, `s3-${region}.amazonaws.com`] : [];
  const endpoints = ["s3.amazonaws.com", ...regional];

  const hasKey = (path: string) => path.length > 1;
  if (endpoints.some((endpoint) => host === `${name}.${endpoint}`)) {
    return hasKey(parsed.pathname);
  }
  if (endpoints.includes(host)) {
    const prefix = `/${bucket}/`;
    return parsed.pathname.startsWith(prefix) && parsed.pathname.length > prefix.length;
  }
  return false;
}

export class AwsS3FileStorage implements FileStorage {
  AWS_S3_BUCKET: string;
  s3: AWS.S3;
  constructor() {
    if (!process.env.AWS_S3_BUCKET) {
      throw new Error("AWS_S3_BUCKET não está definido!");
    }
    this.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  async saveFile({
    taskId,
    file,
  }: ISaveFileRequest): Promise<ISaveFileResponse> {
    if (!this.AWS_S3_BUCKET) {
      throw new Error("AWS_S3_BUCKET não está definido!");
    }

    const params = {
      Bucket: this.AWS_S3_BUCKET,
      Key: String(taskId) + Date.now().toString(),
      Body: file.buffer,
      ACL: "public-read",
      ContentType: file.mimetype,
      ContentDisposition: "inline",
    };
    const { Location } = await this.s3.upload(params).promise();

    return { url: Location };
  }

  isStoredFileUrl(url: string): boolean {
    return isBucketUrl(url, this.AWS_S3_BUCKET, process.env.AWS_REGION);
  }
}
