import type { Task } from "@/domain";
import { isTask } from "@/domain/tasks";

const storageKey = "lifequest.tasks.v1";

export type TaskRepository = {
  load(): Task[];
  save(tasks: Task[]): void;
};

export function createLocalTaskRepository(storage: Storage): TaskRepository {
  return {
    load() {
      const raw = storage.getItem(storageKey);

      if (!raw) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isTask) : [];
      } catch {
        return [];
      }
    },
    save(tasks) {
      storage.setItem(storageKey, JSON.stringify(tasks));
    }
  };
}

export const taskStorageKey = storageKey;
