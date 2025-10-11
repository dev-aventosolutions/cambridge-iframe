"use client";
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

  return (
    <div className="relative md:max-h-auto overflow-hidden">
      <img
        src={"/blue-vector.svg"}
        alt="Blue Vector"
        className="absolute right-0 top-0 z-[1000] 
          h-12 w-auto sm:h-16 md:h-20 lg:h-32"
      />

      <UnifiedSurvey />

      <img
        src={"/cyan-vector.svg"}
        alt="Cyan Vector"
        className="absolute left-0 md:-left-3 -bottom-10 z-[1000] 
          h-16 w-auto sm:h-20 md:h-24 lg:h-32"
      />
    </div>
  );
}

export default MainPage;
