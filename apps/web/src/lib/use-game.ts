"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_GAME, type GameSummary } from "@/lib/game-types";
import { fetchGame } from "@/lib/game-actions";
import { useWorkspace } from "@/lib/store";

/** The viewer's game summary, refreshed whenever the board changes. */
export function useGame(): { game: GameSummary; ready: boolean; reload: () => Promise<void> } {
  const { me, items } = useWorkspace();
  const [game, setGame] = useState<GameSummary>(EMPTY_GAME);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!me) {
      setGame(EMPTY_GAME);
      setReady(true);
      return;
    }
    try {
      setGame({ ...EMPTY_GAME, ...(await fetchGame(me)) });
    } catch {
      setGame(EMPTY_GAME);
    } finally {
      setReady(true);
    }
  }, [me]);

  // Items are the thing that earns points, so a change there is the cue.
  const doneCount = items.filter((i) => i.status === "done").length;
  useEffect(() => {
    void reload();
  }, [reload, doneCount, items.length]);

  return { game, ready, reload };
}
