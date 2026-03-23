import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { projects, pdfFiles, conversations, messages, userStats, InsertConversation, InsertPDFFile, InsertUserStats } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Project Queries =====
export async function createProject(userId: number, data: { name: string; description?: string; color?: string; icon?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projects).values({
    userId,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
  });
  return result;
}

export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId));
}

// ===== PDF File Queries =====
export async function uploadPDFFile(data: {
  userId: number;
  projectId?: number;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  pageCount?: number;
  extractedText?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(pdfFiles).values(data);
  return result;
}

export async function getUserPDFFiles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pdfFiles).where(eq(pdfFiles.userId, userId));
}

export async function getPDFFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pdfFiles).where(eq(pdfFiles.id, id)).limit(1);
  return result[0];
}

export async function updatePDFFile(id: number, data: Partial<InsertPDFFile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(pdfFiles).set(data).where(eq(pdfFiles.id, id));
}

export async function deletePDFFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(pdfFiles).where(eq(pdfFiles.id, id));
}

// ===== Conversation Queries =====
export async function createConversation(data: {
  userId: number;
  projectId?: number;
  title: string;
  description?: string;
  relatedPdfIds?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(conversations).values(data);
  return result;
}

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}

export async function updateConversation(id: number, data: Partial<InsertConversation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(conversations).set(data).where(eq(conversations.id, id));
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(conversations).where(eq(conversations.id, id));
}

// ===== Message Queries =====
export async function addMessage(data: {
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  tokens?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(messages).values(data);
  return result;
}

export async function getConversationMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId));
}

export async function deleteMessage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(messages).where(eq(messages.id, id));
}

// ===== User Stats Queries =====
export async function getOrCreateUserStats(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  
  const result = await db.insert(userStats).values({ userId });
  return result;
}

export async function getUserStats(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);
  return result[0];
}

export async function updateUserStats(userId: number, data: Partial<InsertUserStats>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(userStats).set(data).where(eq(userStats.userId, userId));
}


