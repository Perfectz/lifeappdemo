/**
 * Turns a Timeline Mirror "next quest" into a real Quest in the Quest Log, so
 * the Mirror's advice flows into the same task + XP system as everything else
 * (completing the created quest earns XP like any other task).
 */

import { createLocalTaskRepository } from "@/data/taskRepository";
import { createTask, type TaskInput } from "@/domain/tasks";
import type { Task, TaskPriority, TaskTag } from "@/domain/types";
import { toLocalIsoDate } from "@/domain/dates";
import type { QuestDifficulty, TimelineNextQuest } from "@/domain/timelineMirror";

const DIFFICULTY_TO_PRIORITY: Record<QuestDifficulty, TaskPriority> = {
  easy: "low",
  medium: "medium",
  hard: "high"
};

/** Map a Timeline next-quest into the Quest Log's TaskInput shape. */
export function timelineQuestToTaskInput(quest: TimelineNextQuest): TaskInput {
  // Every Timeline category (movement, nutrition, sleep, grooming, training,
  // mindset, recovery) is a health-domain action in the Quest Log's tag set.
  const tags: TaskTag[] = ["health"];
  const descriptionParts = [quest.description?.trim(), `(Timeline Mirror · ${quest.category})`].filter(
    Boolean
  );
  return {
    title: quest.title.trim() || "Feed the Ideal Timeline",
    description: descriptionParts.join(" "),
    priority: DIFFICULTY_TO_PRIORITY[quest.difficulty] ?? "low",
    tags,
    plannedForDate: toLocalIsoDate()
  };
}

/** Create the quest in the Quest Log (prepended) and return it. */
export function acceptTimelineQuest(quest: TimelineNextQuest): Task {
  const task = createTask(timelineQuestToTaskInput(quest));
  if (typeof window !== "undefined") {
    const repo = createLocalTaskRepository(window.localStorage);
    repo.save([task, ...repo.load()]);
  }
  return task;
}
