import { Icon } from "@/components/mt/icon";
import { Panel } from "@/components/mt/panel";
import { DIMENSION_LABEL, WEIGHTS, band, type Dimension, type Fit, type Gate } from "@/lib/types";
import { cn } from "@/lib/utils";

const GATE: Record<Gate, { icon: string; cls: string }> = {
  pass: { icon: "check_circle", cls: "text-[var(--domain-opportunity)]" },
  fail: { icon: "cancel", cls: "text-destructive" },
  flag: { icon: "error", cls: "text-[var(--domain-revenue)]" },
};

/** MT_v2 Pulse "Ranking signals": label + weight chip + bar + value. */
export function FitPanel({ fit }: { fit?: Fit }) {
  if (!fit) {
    return (
      <Panel title="Fit">
        <p className="text-sm text-muted-foreground">Not evaluated yet. The agent scores it on its next run.</p>
      </Panel>
    );
  }
  const gateFailed = Object.values(fit.gates).some((g) => g.result === "fail");
  const rows: { label: string; gate: Gate; note: string }[] = [
    { label: "Eligibility", gate: fit.gates.eligibility.result, note: fit.gates.eligibility.note },
    { label: "Language", gate: fit.gates.language.result, note: fit.gates.language.note },
    ...(fit.gates.timing ? [{ label: "Timing", gate: fit.gates.timing.result, note: fit.gates.timing.note }] : []),
    { label: "Location", gate: fit.locationPass ? "pass" : "fail", note: fit.locationNote },
    ...fit.dealBreakersHit.map((d) => ({ label: "Deal-breaker", gate: "fail" as Gate, note: d })),
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <div className="space-y-4">
        <Panel title="Gates" action={<span className="text-[0.75rem] text-muted-foreground">{gateFailed ? "not scored" : "all clear"}</span>}>
          <ul className="divide-y divide-outline-variant/60">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-[0.8125rem]">
                <Icon name={GATE[r.gate].icon} size={18} filled className={GATE[r.gate].cls} />
                <span className="w-24 shrink-0 font-medium">{r.label}</span>
                <span className="text-muted-foreground">{r.note}</span>
              </li>
            ))}
          </ul>
        </Panel>
        {!gateFailed && (
          <Panel title="Score" action={<span className="font-display text-[1.125rem] font-medium tabular-nums">{fit.score} <span className="text-[0.75rem] font-sans font-normal text-muted-foreground">{band(fit.score)}</span></span>}>
            <p className="text-[0.75rem] text-muted-foreground -mt-1">Weighted the way the reference pipeline scores: technical 30, experience 25, culture 15, career 30. Location is pass/fail.</p>
            <ul className="space-y-3.5">
              {(Object.keys(WEIGHTS) as Dimension[]).map((d) => {
                const v = fit.dimensions[d];
                return (
                  <li key={d}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[0.8125rem] font-medium">
                        {DIMENSION_LABEL[d]}
                        <span className="px-1.5 h-4 inline-flex items-center rounded bg-primary-container text-primary-container-foreground text-[0.5625rem] font-semibold uppercase tracking-[0.06em]">{Math.round(WEIGHTS[d] * 100)}%</span>
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[0.75rem] tabular-nums">
                        <Icon name={v >= 75 ? "trending_up" : v >= 45 ? "trending_flat" : "trending_down"} size={14} className={cn(v >= 75 ? "text-[var(--domain-opportunity)]" : v >= 45 ? "text-muted-foreground" : "text-destructive")} />
                        {v}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${v}%` }} /></div>
                    {fit.notes?.[d] && <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted-foreground">{fit.notes[d]}</p>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>
      <div className="space-y-4">
        <Panel title="Strengths">
          {fit.strengths.length ? <ul className="space-y-2 text-[0.8125rem]">{fit.strengths.map((s) => <li key={s} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-[var(--domain-opportunity)]" />{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing recorded.</p>}
        </Panel>
        <Panel title="Gaps">
          {fit.gaps.length ? <ul className="space-y-2 text-[0.8125rem]">{fit.gaps.map((s) => <li key={s} className="flex gap-2"><Icon name="remove" size={16} className="mt-0.5 shrink-0 text-muted-foreground" />{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing recorded.</p>}
        </Panel>
        <Panel title="Timing"><p className="text-[0.8125rem]">{fit.urgency}</p></Panel>
        {fit.recommendation && <Panel title="Recommendation"><p className="text-[0.8125rem] leading-relaxed">{fit.recommendation}</p></Panel>}
      </div>
    </div>
  );
}
