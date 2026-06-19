import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isChatThread, type ChatThread } from "@/domain/chat";

const storageKey = "lifequest.chatThreads.v1";

export type ChatThreadRepository = LocalRepository<ChatThread>;

export function createLocalChatThreadRepository(storage: Storage): ChatThreadRepository {
  return createLocalRepository<ChatThread>(storage, storageKey, isChatThread);
}

export const chatThreadStorageKey = storageKey;
