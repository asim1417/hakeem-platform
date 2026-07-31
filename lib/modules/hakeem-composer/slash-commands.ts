import { listCommands, parseCommand } from "@/lib/modules/agents/commands";
import { COMPOSER_SLASH_COMMANDS } from "./constants";
import type { ComposerSlashCommand } from "./types";

export type SlashMenuState = {
  open: boolean;
  query: string;
  startIndex: number;
  activeIndex: number;
};

export function detectSlashTrigger(text: string, caret: number): SlashMenuState | null {
  const before = text.slice(0, caret);
  const match = before.match(/(?:^|\s)(\/[^\s]*)$/);
  if (!match) return null;
  const token = match[1] ?? "";
  const startIndex = before.length - token.length;
  return {
    open: true,
    query: token.slice(1),
    startIndex,
    activeIndex: 0,
  };
}

export function filterSlashCommands(query: string): ComposerSlashCommand[] {
  const q = (query || "").trim().replace(/^\//, "").toLowerCase();
  const agentCmds = listCommands().map((c) => {
    const existing = COMPOSER_SLASH_COMMANDS.find((x) => x.command === c.command);
    return (
      existing ??
      ({
        id: c.command,
        command: c.command,
        label: c.label,
        description: `توجيه إلى ${c.target}`,
        agentCommand: true,
        template: `${c.command} `,
      } satisfies ComposerSlashCommand)
    );
  });

  const merged = new Map<string, ComposerSlashCommand>();
  for (const cmd of [...COMPOSER_SLASH_COMMANDS, ...agentCmds]) {
    merged.set(cmd.command, cmd);
  }
  const all = Array.from(merged.values());
  if (!q) return all;
  return all.filter((c) => {
    const hay = `${c.command} ${c.label} ${c.description}`.toLowerCase();
    return hay.includes(q) || c.command.replace(/^\//, "").includes(q);
  });
}

export function applySlashCommand(
  text: string,
  caret: number,
  command: ComposerSlashCommand
): { text: string; caret: number } {
  const state = detectSlashTrigger(text, caret);
  if (!state) {
    const insert = command.template ?? `${command.command} `;
    return { text: `${text}${insert}`, caret: text.length + insert.length };
  }
  const before = text.slice(0, state.startIndex);
  const after = text.slice(caret);
  const insert = command.template ?? `${command.command} `;
  const next = `${before}${insert}${after}`;
  return { text: next, caret: before.length + insert.length };
}

export function resolveAgentSlash(text: string) {
  return parseCommand(text);
}
