"use client";

import Dashboard from "@/components/admin/dashboard";
import MonitorDashboard from "@/components/admin/monitor/monitor-dashboard";
import { useWorkspace } from "@/components/admin/workspace-provider";

/** Dashboard-ul activ e ales de lentila de workspace — fără cod duplicat. */
export default function AdminDashboardPage() {
  const { workspace } = useWorkspace();
  return workspace === "valcea" ? <MonitorDashboard /> : <Dashboard />;
}
