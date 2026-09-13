"use client";

import { useMemo } from "react";
import { UserRound } from "lucide-react";
import { addDays, fieldsOf, localDay } from "agent-core/shared";
import { ProgressView } from "@/components/progress-view";
import { EmptyState } from "@/components/empty-state";
import { MathCurveLoader } from "@/components/ui/math-curve-loader";
import { useGame } from "@/lib/use-game";
import { useWorkspace } from "@/lib/store";

export default function ProgressPage() {
  const { me, items, timeZone } = useWorkspace();
  const { game, ready, reload } = useGame();

  // The viewer's finished items, per day, for the bars.
  const { counts, labels } = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6, timeZone));
    const keys = days.map((d) => localDay(d, timeZone));
    const mine = items.filter((i) => i.owner_slack_id === me && i.completed_at);
    return {
      counts: keys.map((k) => mine.filter((i) => localDay(new Date(i.completed_at!), timeZone) === k).length),
      labels: days.map((d) => fieldsOf(d, timeZone).weekday.slice(0, 1)),
    };
  }, [items, me, timeZone]);

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <EmptyState icon={UserRound} title="Who are you?" body="Pick yourself in the sidebar — progress is per person, and the game needs to know whose promises these are." />
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <MathCurveLoader curve="rose" size={44} className="text-primary" label="Loading progress" />
      </div>
    );
  }
  return <ProgressView game={game} completedByDay={counts} dayLabels={labels} onChanged={reload} />;
}
