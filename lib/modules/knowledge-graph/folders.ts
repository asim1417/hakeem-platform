import { prisma } from "@/lib/prisma";
import type { Folder } from "@prisma/client";

export async function listFolders(userId: string): Promise<Folder[]> {
  return prisma.folder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export interface CreateFolderInput {
  name: string;
  parentId?: string | null;
}

export async function createFolder(userId: string, input: CreateFolderInput): Promise<Folder> {
  return prisma.folder.create({
    data: {
      userId,
      name: input.name,
      parentId: input.parentId ?? null,
    },
  });
}
