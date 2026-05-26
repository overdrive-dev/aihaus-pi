import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { projectPath, readJsonFile, writeJsonFile } from "../state/project.js";

export const DEFAULT_MAX_PROMPT_CHARS = 8_000;
export const DEFAULT_MAX_DETECTED_ITEMS = 7;
export const DEFAULT_MAX_SLICE_CHARS = 1_800;

export function executionStatePath(cwd) {
  return projectPath(cwd, "state", "execution.json");
}

export function continuePath(cwd) {
  return projectPath(cwd, "continue.md");
}

export function readExecutionState(cwd) {
  return readJsonFile(executionStatePath(cwd), undefined);
}

export function writeExecutionState(cwd, state) {
  writeJsonFile(executionStatePath(cwd), state);
  writeContinueFile(cwd, state);
}

function detectActionItems(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]\s+|\d+[.)]\s+|\[[ xX]\]\s+)/.test(line));
}

export function shouldSliceInput(
  text,
  { maxPromptChars = DEFAULT_MAX_PROMPT_CHARS, maxDetectedItems = DEFAULT_MAX_DETECTED_ITEMS } = {},
) {
  const value = String(text ?? "");
  if (value.length > maxPromptChars) return true;
  return detectActionItems(value).length > maxDetectedItems;
}

function cleanTitle(text) {
  return String(text ?? "")
    .replace(/^(?:[-*]\s+|\d+[.)]\s+|\[[ xX]\]\s+)/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96) || "Untitled slice";
}

function chunkLongText(text, maxSliceChars) {
  const chunks = [];
  let remaining = String(text ?? "").trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxSliceChars) {
      chunks.push(remaining);
      break;
    }
    const window = remaining.slice(0, maxSliceChars);
    const splitAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
    const size = splitAt > maxSliceChars * 0.4 ? splitAt + 1 : maxSliceChars;
    chunks.push(remaining.slice(0, size).trim());
    remaining = remaining.slice(size).trim();
  }
  return chunks;
}

export function splitRequestIntoSlices(request, { maxSliceChars = DEFAULT_MAX_SLICE_CHARS } = {}) {
  const text = String(request ?? "").trim();
  if (!text) return [];

  const items = detectActionItems(text);
  const rawSlices = items.length > 1 ? items : chunkLongText(text, maxSliceChars);

  const slices = [];
  for (const raw of rawSlices) {
    const chunks = raw.length > maxSliceChars ? chunkLongText(raw, maxSliceChars) : [raw];
    for (const chunk of chunks) {
      const index = slices.length + 1;
      slices.push({
        id: `S${String(index).padStart(3, "0")}`,
        title: cleanTitle(chunk),
        status: index === 1 ? "active" : "pending",
        prompt: chunk.trim(),
        evidence: [],
        attempts: 0,
      });
    }
  }
  return slices;
}

export async function createExecutionPlan({
  cwd,
  request,
  reason = "oversized-or-multi-task-request",
  now = new Date().toISOString(),
  maxSliceChars = DEFAULT_MAX_SLICE_CHARS,
} = {}) {
  if (!cwd) throw new Error("createExecutionPlan requires cwd");
  const slices = splitRequestIntoSlices(request, { maxSliceChars });
  if (slices.length === 0) throw new Error("cannot create execution plan from an empty request");

  const state = {
    version: 1,
    status: "active",
    reason,
    createdAt: now,
    updatedAt: now,
    originalRequest: String(request ?? ""),
    cursor: {
      activeIndex: 0,
      completed: [],
    },
    limits: {
      maxSliceChars,
      sourceLength: String(request ?? "").length,
    },
    slices,
  };
  writeExecutionState(cwd, state);
  return state;
}

export function getActiveSlice(state) {
  if (!state || state.status !== "active") return undefined;
  return state.slices?.[state.cursor?.activeIndex ?? 0];
}

export async function advanceExecutionCursor({ cwd, now = new Date().toISOString() } = {}) {
  const state = readExecutionState(cwd);
  if (!state) throw new Error("no execution plan found; run /aih-exec plan <request> first");

  const activeIndex = state.cursor?.activeIndex ?? 0;
  if (state.slices?.[activeIndex]) {
    state.slices[activeIndex] = {
      ...state.slices[activeIndex],
      status: "done",
      completedAt: now,
    };
  }

  const nextIndex = activeIndex + 1;
  if (nextIndex >= (state.slices?.length ?? 0)) {
    state.status = "done";
    state.cursor = {
      ...(state.cursor ?? {}),
      activeIndex,
      completed: [...new Set([...(state.cursor?.completed ?? []), state.slices?.[activeIndex]?.id].filter(Boolean))],
    };
  } else {
    state.slices[nextIndex] = { ...state.slices[nextIndex], status: "active" };
    state.cursor = {
      ...(state.cursor ?? {}),
      activeIndex: nextIndex,
      completed: [...new Set([...(state.cursor?.completed ?? []), state.slices?.[activeIndex]?.id].filter(Boolean))],
    };
  }

  state.updatedAt = now;
  writeExecutionState(cwd, state);
  return state;
}

export function buildSlicedPrompt(state) {
  const active = getActiveSlice(state);
  if (!active) {
    return "No active aihaus-pi execution slice. Ask the user what to do next.";
  }

  return [
    `aihaus-pi split the original request into ${state.slices.length} slices to avoid context overflow and partial execution.`,
    `Execute only active slice ${active.id}: ${active.title}`,
    "Do not execute later slices. Do not claim the whole request is complete.",
    "When this slice is complete, produce evidence and ask/run `/aih-exec next` to advance the cursor.",
    "",
    "## Active slice prompt",
    active.prompt,
    "",
    "## Continuation state",
    `Cursor: ${active.id} (${(state.cursor?.activeIndex ?? 0) + 1}/${state.slices.length})`,
    "State files: aihaus-pi/state/execution.json and aihaus-pi/continue.md",
  ].join("\n");
}

export function buildContinueMarkdown(state) {
  const active = getActiveSlice(state);
  const completed = new Set(state.cursor?.completed ?? []);
  return [
    "# aihaus-pi Continue",
    "",
    `Status: ${state.status}`,
    `Reason: ${state.reason}`,
    `Updated: ${state.updatedAt}`,
    active ? `Active slice: ${active.id} - ${active.title}` : "Active slice: none",
    "",
    "## Slices",
    ...(state.slices ?? []).map((slice) => {
      const marker = slice.status === "done" || completed.has(slice.id) ? "x" : slice.status === "active" ? ">" : " ";
      return `- [${marker}] ${slice.id}: ${slice.title}`;
    }),
    "",
    "## Resume Protocol",
    "1. Load aihaus-pi/state/execution.json.",
    "2. Execute only the active slice.",
    "3. Attach evidence for that slice.",
    "4. Advance with /aih-exec next only after verification.",
    "",
  ].join("\n");
}

export function writeContinueFile(cwd, state) {
  const path = continuePath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buildContinueMarkdown(state), "utf8");
}

export function clearExecutionState(cwd) {
  const path = executionStatePath(cwd);
  const cleared = {
    version: 1,
    status: "cleared",
    updatedAt: new Date().toISOString(),
    cursor: { activeIndex: 0, completed: [] },
    slices: [],
  };
  if (existsSync(path)) writeExecutionState(cwd, cleared);
  return cleared;
}
