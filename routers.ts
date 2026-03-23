import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // PDF Files Management
  pdf: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserPDFFiles(ctx.user.id);
    }),
    upload: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "object" || val === null) throw new Error("Invalid input");
        const obj = val as Record<string, unknown>;
        return {
          fileName: String(obj.fileName || ""),
          fileKey: String(obj.fileKey || ""),
          fileUrl: String(obj.fileUrl || ""),
          fileSize: Number(obj.fileSize || 0),
          projectId: obj.projectId ? Number(obj.projectId) : undefined,
          pageCount: obj.pageCount ? Number(obj.pageCount) : undefined,
          extractedText: obj.extractedText ? String(obj.extractedText) : undefined,
        };
      })
      .mutation(async ({ ctx, input }) => {
        const result = await db.uploadPDFFile({
          userId: ctx.user.id,
          ...input,
        });
        // Update user stats
        const stats = await db.getUserStats(ctx.user.id);
        if (stats) {
          await db.updateUserStats(ctx.user.id, {
            totalFiles: (stats.totalFiles || 0) + 1,
            totalStorageUsed: (stats.totalStorageUsed || 0) + input.fileSize,
          });
        }
        return result;
      }),
    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "number") throw new Error("Invalid input");
        return val;
      })
      .mutation(async ({ ctx, input: fileId }) => {
        const file = await db.getPDFFileById(fileId);
        if (!file || file.userId !== ctx.user.id) throw new Error("Unauthorized");
        
        await db.deletePDFFile(fileId);
        
        // Update user stats
        const stats = await db.getUserStats(ctx.user.id);
        if (stats) {
          await db.updateUserStats(ctx.user.id, {
            totalFiles: Math.max(0, (stats.totalFiles || 0) - 1),
            totalStorageUsed: Math.max(0, (stats.totalStorageUsed || 0) - (file.fileSize || 0)),
          });
        }
      }),
  }),

  // Conversations Management
  conversation: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserConversations(ctx.user.id);
    }),
    create: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "object" || val === null) throw new Error("Invalid input");
        const obj = val as Record<string, unknown>;
        return {
          title: String(obj.title || "New Conversation"),
          description: obj.description ? String(obj.description) : undefined,
          projectId: obj.projectId ? Number(obj.projectId) : undefined,
          relatedPdfIds: obj.relatedPdfIds ? String(obj.relatedPdfIds) : undefined,
        };
      })
      .mutation(async ({ ctx, input }) => {
        const result = await db.createConversation({
          userId: ctx.user.id,
          ...input,
        });
        
        // Update user stats
        const stats = await db.getUserStats(ctx.user.id);
        if (stats) {
          await db.updateUserStats(ctx.user.id, {
            totalConversations: (stats.totalConversations || 0) + 1,
          });
        }
        return result;
      }),
    get: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "number") throw new Error("Invalid input");
        return val;
      })
      .query(async ({ ctx, input: conversationId }) => {
        const conv = await db.getConversationById(conversationId);
        if (!conv || conv.userId !== ctx.user.id) throw new Error("Unauthorized");
        return conv;
      }),
    delete: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "number") throw new Error("Invalid input");
        return val;
      })
      .mutation(async ({ ctx, input: conversationId }) => {
        const conv = await db.getConversationById(conversationId);
        if (!conv || conv.userId !== ctx.user.id) throw new Error("Unauthorized");
        
        await db.deleteConversation(conversationId);
        
        // Update user stats
        const stats = await db.getUserStats(ctx.user.id);
        if (stats) {
          await db.updateUserStats(ctx.user.id, {
            totalConversations: Math.max(0, (stats.totalConversations || 0) - 1),
            totalMessages: Math.max(0, (stats.totalMessages || 0) - (conv.messageCount || 0)),
          });
        }
      }),
  }),

  // Messages Management
  message: router({
    list: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "number") throw new Error("Invalid input");
        return val;
      })
      .query(async ({ ctx, input: conversationId }) => {
        const conv = await db.getConversationById(conversationId);
        if (!conv || conv.userId !== ctx.user.id) throw new Error("Unauthorized");
        return db.getConversationMessages(conversationId);
      }),
    send: protectedProcedure
      .input((val: unknown) => {
        if (typeof val !== "object" || val === null) throw new Error("Invalid input");
        const obj = val as Record<string, unknown>;
        return {
          conversationId: Number(obj.conversationId || 0),
          content: String(obj.content || ""),
          tokens: obj.tokens ? Number(obj.tokens) : 0,
        };
      })
      .mutation(async ({ ctx, input }) => {
        
        const conv = await db.getConversationById(input.conversationId);
        if (!conv || conv.userId !== ctx.user.id) throw new Error("Unauthorized");
        
        // Add user message
        await db.addMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.content,
          tokens: input.tokens,
        });
        
        // Get LLM response
        const messages = await db.getConversationMessages(input.conversationId);
        const llmMessages = messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        
        const response = await invokeLLM({
          messages: llmMessages,
        });
        
        const assistantContent = (typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : "") as string;
        
        // Add assistant message
        await db.addMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: assistantContent,
        });
        
        // Update conversation
        await db.updateConversation(input.conversationId, {
          messageCount: (conv.messageCount || 0) + 2,
          lastMessageAt: new Date(),
        });
        
        // Update user stats
        const statsData = await db.getUserStats(ctx.user.id);
        if (statsData) {
          await db.updateUserStats(ctx.user.id, {
            totalMessages: (statsData.totalMessages || 0) + 2,
            totalTokensUsed: (statsData.totalTokensUsed || 0) + input.tokens,
            lastActivityAt: new Date(),
          });
        }
        
        return { content: assistantContent };
      }),
  }),

  // User Stats
  stats: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      let stats = await db.getUserStats(ctx.user.id);
      if (!stats) {
        const result = await db.getOrCreateUserStats(ctx.user.id);
        stats = await db.getUserStats(ctx.user.id) || undefined;
      }
      return stats;
    }),
  }),
});

export type AppRouter = typeof appRouter;
