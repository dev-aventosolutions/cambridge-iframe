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

  // Always show the unified survey now

  return (
    <div className="relative md:max-h-screen overflow-hidden">
      <img src={"/blue-vector.png"} className="absolute right-0 top-0 z-[1000] h-36 md:h-48"/>
   
      <UnifiedSurvey />
      <img src={"/cyan-vector.png"} className="absolute left-0 md:-left-3 -bottom-14 z-[1000]  h-24 md:h-48"/>
    </div>
  );
}

export default MainPage;
