import { RecommendClient } from "./RecommendClient";
import { Suspense } from "react";

export default function RecommendPage() {
  return (
    <Suspense fallback={null}>
      <RecommendClient />
    </Suspense>
  );
}
