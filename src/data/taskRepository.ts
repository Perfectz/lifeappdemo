import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { Task } from "@/domain";
import { isTask } from "@/domain/tasks";

const storageKey = "lifequest.tasks.v1";

export type TaskRepository = LocalRepository<Task>;

export function createLocalTaskRepository(storage: Storage): TaskRepository {
  return createLocalRepository<Task>(storage, storageKey, isTask);
}

export const taskStorageKey = storageKey;
