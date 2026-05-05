import type { Task } from "@/domain";

type DashboardQuestCardProps = {
  task: Task;
};

export function DashboardQuestCard({ task }: DashboardQuestCardProps) {
  return (
    <article className="dashboard-quest-card">
      <div>
        <h3>
          <span className={`priority-gem priority-gem-${task.priority}`} aria-hidden="true" />
          {task.title}
        </h3>
        {task.description ? <p>{task.description}</p> : null}
      </div>
      <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
    </article>
  );
}
