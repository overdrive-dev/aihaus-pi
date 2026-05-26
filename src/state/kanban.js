import { projectPath, readJsonFile, writeJsonFile, defaultKanban } from "./project.js";

export function kanbanPath(cwd) {
  return projectPath(cwd, "state", "kanban.json");
}

export function readKanban(cwd) {
  return readJsonFile(kanbanPath(cwd), defaultKanban());
}

export function writeKanban(cwd, kanban) {
  writeJsonFile(kanbanPath(cwd), {
    ...kanban,
    updatedAt: new Date().toISOString(),
  });
}

export function tasksByStage(kanban) {
  const stages = new Map((kanban.stages ?? []).map((stage) => [stage.name, []]));
  for (const task of kanban.tasks ?? []) {
    const stage = task.stage ?? "Backlog";
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage).push(task);
  }
  return stages;
}

export function collectTaskBlockers(kanban) {
  const blockers = [...(kanban.blockers ?? [])];
  for (const task of kanban.tasks ?? []) {
    for (const blocker of task.blockers ?? []) {
      blockers.push({ taskId: task.id, taskTitle: task.title, text: blocker });
    }
  }
  return blockers;
}

export function activeTasks(kanban) {
  return (kanban.tasks ?? []).filter((task) => !["Done", "Deploy", "Aprovados"].includes(task.stage));
}
