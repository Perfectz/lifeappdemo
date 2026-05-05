import type { IsoDate, Task } from "@/domain";
import { isIsoTimestampOnDate } from "@/domain/dates";

export type DashboardStats = {
  activeBacklogCount: number;
  completedTodayCount: number;
  plannedTodayTasks: Task[];
};

export function getDashboardStats(tasks: Task[], today: IsoDate): DashboardStats {
  const activeTasks = tasks.filter((task) => task.status === "todo");

  return {
    plannedTodayTasks: activeTasks.filter((task) => task.plannedForDate === today),
    activeBacklogCount: activeTasks.filter((task) => task.plannedForDate !== today).length,
    completedTodayCount: tasks.filter((task) => isIsoTimestampOnDate(task.completedAt, today))
      .length
  };
}
