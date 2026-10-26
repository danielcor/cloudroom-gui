import { useEffect, useRef, useState } from "react";
import { Button } from "@cloudroom/shared-ui/button";
import { Icon } from "@cloudroom/shared-ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cloudroom/shared-ui/tooltip";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@cloudroom/shared-ui/lib/utils";
import { appToast } from "@/components/ui/app-toast";
import { useCloudroomAccount } from "@/hooks/queries/cloudroom-queries";
import { UpgradeTip } from "@/components/UpgradeTip";
import { openUpgrade, useUpgradePromptViewed } from "@/lib/upgrade-prompt";

// The cloud queue (docs/scopes/public-launch.md): Free accounts wait in line to start Cloud threads. Everything else,
// including Local threads, works as usual. The website decides; these only show it.
export type CloudQueue = { position: number; total: number; regionBlocked: boolean };

/** Under the new-thread composer while Cloud is picked and the account waits. */
export function CloudQueueCard({ queue, onUseLocal }: { queue: CloudQueue; onUseLocal: () => void }) {
  const local = <Button type="button" size="sm" variant="outline" onClick={onUseLocal}><Icon name="Laptop" aria-hidden />Run it on Local</Button>;
  useUpgradePromptViewed(queue.regionBlocked ? null : "queue");
  if (queue.regionBlocked) {
    return (
      <section aria-label="Cloud unavailable" className="mt-3 flex gap-3 rounded-lg border border-foreground/10 bg-surface-raised-solid p-4">
        <Icon name="Cloud" className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Cloud isn't available in your region yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">We're adding cloud capacity region by region. Local threads work as usual.</p>
          </div>
          {local}
        </div>
      </section>
    );
  }
  // The share of the line behind you: it fills up as people ahead get in.
  const behind = queue.total > 0 ? Math.max(4, Math.round(((queue.total - queue.position + 1) / queue.total) * 100)) : 4;
  return (
    <section aria-label="Cloud queue" className="mt-3 flex gap-3 rounded-lg border border-foreground/10 bg-surface-raised-solid p-4">
      <Icon name="Cloud" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">You're in the cloud queue</p>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">#{queue.position.toLocaleString("en-US")} in line</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">We let people into the cloud in small batches so it stays fast. We'll tell you here when it's your turn. Local threads work right now.</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10"><div className="h-full rounded-full bg-primary" style={{ width: `${behind}%` }} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => openUpgrade("queue")}><Icon name="Zap" aria-hidden />Skip the queue with Pro</Button>
          {local}
          <span className="text-xs text-muted-foreground">Pro is $50/month</span>
        </div>
      </div>
    </section>
  );
}

const share = (used: number, limit: number) => limit > 0 ? Math.min(used / limit, 1) : 1;

/** Free accounts always see their usage card. Paid plans see a quiet meter once a limit is 75% used. */
export function PlanCard() {
  const usage = useCloudroomAccount().data?.planUsage ?? null;
  const free = usage?.plan === "free";
  const rows = usage ? [
    { label: "cloud agents", used: usage.agents, limit: usage.agentsLimit },
    ...(usage.cpuHours === null ? [] : [{ label: "agent hours", used: usage.cpuHours, limit: usage.cpuHoursLimit }]),
  ] : [];
  const near = rows.filter(({ used, limit }) => share(used, limit) >= 0.75);
  const hidden = !usage || (!free && !near.length);
  useUpgradePromptViewed(hidden ? null : "plan_card");
  if (!usage || hidden) return null;
  if (!free) return <PlanMeter plan={usage.plan} rows={near} />;
  return (
    <section aria-label="Free plan" className="rounded-lg border border-border bg-surface-raised-solid p-3">
      <p className="text-xs text-muted-foreground">Free plan</p>
      {rows.map(({ label, used, limit }) => {
        const low = share(used, limit) >= 0.8;
        return (
          <div key={label} className="mt-2.5">
            <p className="mb-1.5 text-sm text-foreground"><span className={cn("font-semibold", low && "text-warning")}>{Math.max(0, Math.floor(limit - used)).toLocaleString("en-US")}</span> {label} left</p>
            <div className="h-1 overflow-hidden rounded-full bg-foreground/10"><div className={cn("h-full rounded-full", low ? "bg-warning" : "bg-primary")} style={{ width: `${share(used, limit) * 100}%` }} /></div>
          </div>
        );
      })}
      <Button type="button" size="sm" className="mt-3 w-full justify-start" onClick={() => openUpgrade("plan_card")}>
        <span className="min-w-0 truncate">Get 10× more with Pro</span><span className="ml-auto shrink-0 font-normal opacity-70">$50/mo</span><Icon name="ArrowRight" aria-hidden />
      </Button>
    </section>
  );
}

/** "Super 812 / 900 agent hours" over a thin bar: amber from 75%, red at the limit. Opens /billing. */
function PlanMeter({ plan, rows }: { plan: string; rows: { label: string; used: number; limit: number }[] }) {
  const name = plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <button type="button" aria-label={`${name} plan usage`} className="w-full space-y-2 px-2 pb-1 text-left" onClick={() => openUpgrade("plan_card")}>
      {rows.map(({ label, used, limit }) => {
        const full = used >= limit;
        return (
          <div key={label}>
            <p className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{name}</span>
              <span><span className={cn("font-semibold", full ? "text-destructive" : "text-warning")}>{Math.floor(used).toLocaleString("en-US")}</span><span className="text-muted-foreground"> / {Math.round(limit).toLocaleString("en-US")} {label}</span></span>
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10"><div className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-warning")} style={{ width: `${share(used, limit) * 100}%` }} /></div>
          </div>
        );
      })}
    </button>
  );
}

const PRO_REASONS = [
  "Pro gives you 1,000 cloud agents a month. Free gives you 100.",
  "Pro has no daily limit. Free stops at 50 new cloud agents a day.",
  "Pro gives you 300 agent hours every month.",
  "Pro keeps cloud agents awake 4× longer, so they reply faster.",
  "Pro cloud agents never get paused when the cloud gets busy.",
  "Pro keeps your chat history up to 1 year. Free keeps 7 days.",
];
let lastReason = Math.floor(Math.random() * PRO_REASONS.length);
const nextReason = () => PRO_REASONS[(lastReason = (lastReason + 1) % PRO_REASONS.length)];

export function FreePlanTip() {
  const usage = useCloudroomAccount().data?.planUsage ?? null;
  const [reason] = useState(nextReason);
  if (usage?.plan !== "free") return null;
  return <UpgradeTip where="free_tip" className="mt-3 px-3.5">{reason}</UpgradeTip>;
}

const OG_HIDDEN_KEY = "cloudroom.ogLetterHiddenUntil";
const HAND = { fontFamily: '"Bradley Hand", "Noteworthy", "Segoe Print", cursive' };

/** David's letter to OG beta testers under the new-thread composer (ADR 0218). The website sends `og` only to OGs still
 *  on the free Pro it gave them, never to Free, paying, or team accounts. "Not now" hides it for 3 days. */
export function OgLetter() {
  const og = useCloudroomAccount().data?.planUsage?.og ?? null;
  const [hidden, setHidden] = useState(() => Number(localStorage.getItem(OG_HIDDEN_KEY)) > Date.now());
  const show = Boolean(og) && !hidden;
  useUpgradePromptViewed(show ? "og_letter" : null);
  if (!og || !show) return null;
  const ends = new Date(og.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const notNow = () => {
    localStorage.setItem(OG_HIDDEN_KEY, String(Date.now() + 3 * 86_400_000));
    setHidden(true);
  };
  return (
    <section aria-label="A note from David" className="mt-3 rounded-sm bg-[#f3eee2] px-6 pb-3.5 pt-3 text-[#2a2a28] shadow-lg [background-image:repeating-linear-gradient(180deg,transparent_0_29px,rgba(70,110,160,0.16)_29px_30px)] [background-position:0_13px]">
      <p className="text-lg leading-[30px]" style={HAND}>
        {og.name ? `Hey ${og.name},` : "Hey,"}<br />
        thanks for testing Cloudroom so early.<br />
        Free Pro ends {ends}, but you keep 50% off forever.
      </p>
      <p className="mb-2.5 text-2xl" style={{ fontFamily: '"Snell Roundhand", "Bradley Hand", cursive' }}>David</p>
      <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-3">
        <span className="border-[1.5px] border-dashed border-[#2a2a28] px-2 py-0.5 font-mono text-xs font-bold tracking-widest">OG50</span>
        <span className="text-xs text-[#6b665b]">Only 39 people have this code</span>
        <button type="button" className="ml-auto text-xs text-[#6b665b] hover:text-[#2a2a28]" onClick={notNow}>Not now</button>
        <Button type="button" size="sm" className="border-[#1a1a1a] bg-[#1a1a1a] text-[#f3eee2] hover:bg-black" onClick={() => openUpgrade("og_letter", "https://www.cloudroom.dev/billing?keep=pro")}>
          Keep Pro for $25/mo
        </Button>
      </div>
    </section>
  );
}

/** Sidebar footer badge while the account waits. Says so once when the account gets in. */
export function CloudQueueChip() {
  const queue = useCloudroomAccount().data?.cloudQueue ?? null;
  const waited = useRef(false);
  useEffect(() => {
    if (queue && !queue.regionBlocked) waited.current = true;
    else if (!queue && waited.current) {
      waited.current = false;
      appToast.success("You're in! Cloud threads are ready.");
    }
  }, [queue]);
  useUpgradePromptViewed(queue && !queue.regionBlocked ? "queue_badge" : null);
  if (!queue || queue.regionBlocked) return null;
  return (
    <SidebarMenuItem data-footer-item="cloud-queue">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" aria-label={`Cloud queue: number ${queue.position}`} className="h-[26px] gap-1 rounded-md bg-primary/15 px-2 text-xs font-medium text-primary hover:bg-primary/25 hover:text-primary [&_[data-icon-root]]:size-3.5" onClick={() => openUpgrade("queue_badge")}>
            <Icon name="Cloud" aria-hidden />
            #{queue.position.toLocaleString("en-US")}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">You're #{queue.position.toLocaleString("en-US")} in the cloud queue. Get Pro to skip it.</TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}
