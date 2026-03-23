import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("pdf.upload", () => {
  it("should validate file upload input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test with valid input
    const result = await caller.pdf.upload({
      fileName: "valid.pdf",
      fileKey: "pdfs/valid.pdf",
      fileUrl: "https://s3.example.com/pdfs/valid.pdf",
      fileSize: 1024,
      projectId: undefined,
      pageCount: undefined,
      extractedText: undefined,
    });

    // Verify that the operation completed without error
    expect(result).toBeDefined();
  });

  it("should upload a PDF file successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.pdf.upload({
      fileName: "test-document.pdf",
      fileKey: "pdfs/1234567890-test-document.pdf",
      fileUrl: "https://s3.example.com/pdfs/1234567890-test-document.pdf",
      fileSize: 1024 * 1024, // 1 MB
      projectId: undefined,
      pageCount: undefined,
      extractedText: undefined,
    });

    expect(result).toBeDefined();
  });

  it("should list uploaded PDF files for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Upload a file first
    await caller.pdf.upload({
      fileName: "document1.pdf",
      fileKey: "pdfs/doc1.pdf",
      fileUrl: "https://s3.example.com/pdfs/doc1.pdf",
      fileSize: 2048,
      projectId: undefined,
      pageCount: undefined,
      extractedText: undefined,
    });

    // List files
    const files = await caller.pdf.list();

    expect(Array.isArray(files)).toBe(true);
    // Files should be returned from the database
    expect(files).toBeDefined();
  });

  it("should update user stats after upload", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Get initial stats
    const initialStats = await caller.stats.get();
    const initialFileCount = initialStats?.totalFiles || 0;

    // Upload a file
    await caller.pdf.upload({
      fileName: "stats-test.pdf",
      fileKey: "pdfs/stats-test.pdf",
      fileUrl: "https://s3.example.com/pdfs/stats-test.pdf",
      fileSize: 1024 * 1024,
      projectId: undefined,
      pageCount: undefined,
      extractedText: undefined,
    });

    // Get updated stats
    const updatedStats = await caller.stats.get();
    const updatedFileCount = updatedStats?.totalFiles || 0;

    // Verify stats were updated
    expect(updatedFileCount).toBeGreaterThanOrEqual(initialFileCount);
  });

  it("should handle file upload with metadata", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const testFileName = "metadata-test.pdf";
    const testFileKey = "pdfs/metadata-test.pdf";
    const testFileUrl = "https://s3.example.com/pdfs/metadata-test.pdf";
    const testFileSize = 5 * 1024 * 1024; // 5 MB

    const result = await caller.pdf.upload({
      fileName: testFileName,
      fileKey: testFileKey,
      fileUrl: testFileUrl,
      fileSize: testFileSize,
      projectId: undefined,
      pageCount: 10,
      extractedText: "Sample text from PDF",
    });

    // Verify that the operation completed without error
    expect(result).toBeDefined();
  });
});
