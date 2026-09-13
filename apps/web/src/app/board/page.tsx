import { Suspense } from "react";
import { Board } from "@/components/board";

export default function BoardPage() {
  return (
    <Suspense fallback={null}>
      <Board />
    </Suspense>
  );
}
