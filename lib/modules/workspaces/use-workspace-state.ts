"use client";

// حفظ حالة مساحة العمل في المتصفّح (§18) — آخر مساحة/مسار/فلاتر.
import { useCallback, useEffect, useState } from "react";
import {
  WORKSPACE_STATE_KEY,
  type WorkspaceState,
  type WorkspaceId,
} from "./registry";

export function useWorkspaceState() {
  const [state, setState] = useState<WorkspaceState | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_STATE_KEY);
      if (raw) setState(JSON.parse(raw) as WorkspaceState);
    } catch {
      /* تجاهل التخزين المعطوب */
    }
  }, []);

  const save = useCallback((next: Partial<WorkspaceState> & { workspaceId: WorkspaceId }) => {
    const merged: WorkspaceState = {
      ...next,
      updatedAt: new Date().toISOString(),
    };
    setState(merged);
    try {
      localStorage.setItem(WORKSPACE_STATE_KEY, JSON.stringify(merged));
    } catch {
      /* تجاهل عند امتلاء التخزين */
    }
  }, []);

  return { state, save };
}
