import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { merchant } from "../middleware/access";
import { db } from "../database";
import * as s from "../database/schema";
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const media = z.enum(["image/jpeg", "image/png", "image/webp", "model/gltf-binary"]);
const urlFor = (key: string) => `https://${process.env.S3_BUCKET}.t3.tigrisfiles.io/${key}`;
export const upload = {
  presign: merchant
    .input(
      z.object({
        filename: z.string().max(200),
        contentType: media,
        size: z
          .number()
          .int()
          .positive()
          .max(20 * 1024 * 1024),
      }),
    )
    .handler(async ({ context, input }) => {
      if (input.contentType === "model/gltf-binary" && !context.plan.premium)
        throw new ORPCError("FORBIDDEN", { message: "Modelos 3D exigem plano Premium." });
      const ext = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "model/gltf-binary": "glb",
      }[input.contentType];
      const key = `companies/${context.company.id}/${crypto.randomUUID()}.${ext}`;
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          ContentType: input.contentType,
          ContentLength: input.size,
          ACL: "public-read",
        }),
        { expiresIn: 300, signableHeaders: new Set(["x-amz-acl"]) },
      );
      return { url, key, publicUrl: urlFor(key) };
    }),
  complete: merchant
    .input(z.object({ key: z.string(), contentType: media }))
    .handler(async ({ context, input }) => {
      if (!input.key.startsWith(`companies/${context.company.id}/`))
        throw new ORPCError("FORBIDDEN");
      if (input.contentType === "model/gltf-binary" && !context.plan.premium)
        throw new ORPCError("FORBIDDEN", { message: "Modelos 3D exigem plano Premium." });
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: input.key }),
      );
      if (
        !(head.ContentLength ?? 0) ||
        (head.ContentLength ?? 0) > 20 * 1024 * 1024 ||
        head.ContentType !== input.contentType
      )
        throw new ORPCError("BAD_REQUEST", { message: "Arquivo inválido." });
      const sample = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: input.key,
          Range: "bytes=0-15",
        }),
      );
      const bytes = await sample.Body?.transformToByteArray();
      const magic = bytes ? Buffer.from(bytes) : Buffer.alloc(0);
      const valid =
        input.contentType === "image/jpeg"
          ? magic[0] === 255 && magic[1] === 216 && magic[2] === 255
          : input.contentType === "image/png"
            ? magic.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : input.contentType === "image/webp"
              ? magic.toString("ascii", 0, 4) === "RIFF" &&
                magic.toString("ascii", 8, 12) === "WEBP"
              : magic.toString("ascii", 0, 4) === "glTF" &&
                magic.length >= 12 &&
                magic.readUInt32LE(4) === 2 &&
                magic.readUInt32LE(8) === head.ContentLength;
      if (!valid)
        throw new ORPCError("BAD_REQUEST", {
          message: "O conteúdo não corresponde ao formato informado.",
        });
      await db.insert(s.files).values({
        id: crypto.randomUUID(),
        companyId: context.company.id,
        key: input.key,
        url: urlFor(input.key),
        type: input.contentType,
        createdAt: new Date().toISOString(),
      });
      return { url: urlFor(input.key) };
    }),
};
export const uploadRoutes = upload;
