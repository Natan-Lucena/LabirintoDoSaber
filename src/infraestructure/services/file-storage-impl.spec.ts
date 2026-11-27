import { describe, it, expect } from "vitest";
import { isBucketUrl } from "./file-storage-impl";

describe("isBucketUrl (AT-05)", () => {
  const bucket = "labirinto-media";
  const region = "sa-east-1";

  it.each([
    "https://labirinto-media.s3.sa-east-1.amazonaws.com/abc123.png",
    "https://labirinto-media.s3.amazonaws.com/abc123.png",
    "https://s3.sa-east-1.amazonaws.com/labirinto-media/abc123.png",
  ])("aceita %s", (url) => {
    expect(isBucketUrl(url, bucket, region)).toBe(true);
  });

  it.each([
    "https://example.com/abc123.png",
    "http://labirinto-media.s3.sa-east-1.amazonaws.com/abc123.png",
    "https://outro-bucket.s3.sa-east-1.amazonaws.com/abc123.png",
    "https://labirinto-media.s3.sa-east-1.amazonaws.com.evil.com/abc123.png",
    "https://evil.com/labirinto-media.s3.sa-east-1.amazonaws.com/abc.png",
    "https://s3.sa-east-1.amazonaws.com/outro-bucket/abc123.png",
    "https://labirinto-media.s3.sa-east-1.amazonaws.com/",
    "https://user:pw@labirinto-media.s3.amazonaws.com/abc.png",
    "não é url",
  ])("recusa %s", (url) => {
    expect(isBucketUrl(url, bucket, region)).toBe(false);
  });
});
