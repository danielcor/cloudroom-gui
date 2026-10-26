import { z } from "zod/mini";

export interface PlanMeter {
  label: string;
  used: number;
  limit: number;
  unit: string;
}

export interface PlanSummary {
  plan: string;
  period: string;
  meters: PlanMeter[];
}

const agentsAndHoursSchema = z.object({
  plan: z.string(),
  agents: z.number(),
  agentsLimit: z.number(),
  cpuHours: z.nullable(z.number()),
  cpuHoursLimit: z.number(),
});

export function fromAgentsAndHours(
  usage: z.infer<typeof agentsAndHoursSchema>,
): PlanSummary {
  return {
    plan: usage.plan,
    period: "last 30 days",
    meters: [
      ...(usage.agentsLimit >= Number.MAX_SAFE_INTEGER
        ? []
        : [{ label: "agents", used: usage.agents, limit: usage.agentsLimit, unit: "" }]),
      ...(usage.cpuHours === null
        ? []
        : [{ label: "hours", used: usage.cpuHours, limit: usage.cpuHoursLimit, unit: "h" }]),
    ],
  };
}

const accountStatusSchema = z.object({
  planUsage: z.optional(z.nullable(agentsAndHoursSchema)),
});

export async function loadPlanSummary(
  signal?: AbortSignal,
): Promise<PlanSummary | null> {
  const response = await fetch("/api/v1/cloudroom/account", { signal });
  if (!response.ok) throw new Error(`Plan usage returned HTTP ${response.status}.`);
  const parsed = accountStatusSchema.safeParse(await response.json());
  const usage = parsed.success ? parsed.data.planUsage : null;
  return usage ? fromAgentsAndHours(usage) : null;
}

export function planMeterPercent(meter: PlanMeter): number {
  return meter.limit > 0 ? Math.min(100, (meter.used / meter.limit) * 100) : 100;
}

export function planMeterLeft(meter: PlanMeter): string {
  return `${Math.max(0, Math.floor(meter.limit - meter.used)).toLocaleString("en-US")}${meter.unit} left`;
}
