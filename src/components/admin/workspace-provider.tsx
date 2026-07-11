"use client";

/**
 * Contextul de workspace: aceeași redacție, aceleași motoare, lentile
 * diferite. Schimbarea workspace-ului filtrează Inbox, Stories, Entities,
 * Sources, Alerts și dashboard-ul — fără cod duplicat.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  WORKSPACES,
  type Workspace,
  type WorkspaceDef,
} from "@/lib/engine/workspace";

const STORAGE_KEY = "pulsnow24-workspace";

interface WorkspaceContextValue {
  workspace: Workspace;
  workspaceDef: WorkspaceDef;
  setWorkspace: (w: Workspace) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace trebuie folosit în interiorul <WorkspaceProvider>");
  }
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspaceState] = useState<Workspace>("national");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && WORKSPACES.some((w) => w.id === saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspaceState(saved as Workspace);
    }
  }, []);

  const setWorkspace = useCallback((w: Workspace) => {
    setWorkspaceState(w);
    localStorage.setItem(STORAGE_KEY, w);
  }, []);

  const workspaceDef =
    WORKSPACES.find((w) => w.id === workspace) ?? WORKSPACES[0];

  return (
    <WorkspaceContext.Provider value={{ workspace, workspaceDef, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
