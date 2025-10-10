'use client'
import { useState, useEffect } from "react";
import UnifiedSurvey from "./components/UnifiedSurvey";

function MainPage() {
  const [view, setView] = useState<"iframe1" | "iframe2">("iframe1");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryView = params.get("view");
    if (queryView === "iframe1" || queryView === "iframe2") {
      setView(queryView);
    }
  }, []);

  // Always show the unified survey now
  return <UnifiedSurvey />;
}

export default MainPage;