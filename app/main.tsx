'use client'
import { useState } from "react";
import QuestionSwiper from "./components/QuestionSwiper";
import AnswersDisplay from "./components/AnswersDisplay";
import { useEffect } from "react";

function MainPage() {
  const [view, setView] = useState<"iframe1" | "iframe2">("iframe1");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryView = params.get("view");
    if (queryView === "iframe1" || queryView === "iframe2") {
      setView(queryView);
    }
  }, []);

  if (view === "iframe1") {
    return <QuestionSwiper />;
  }

  if (view === "iframe2") {
    return <AnswersDisplay />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Survey System
          </h1>
          <p className="text-xl text-blue-200">Choose a view to get started</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => setView("iframe1")}
            className="group bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Question Survey
            </h2>
            <p className="text-slate-600">
              Answer questions and submit your responses
            </p>
          </button>

          <button
            onClick={() => setView("iframe2")}
            className="group bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              View Responses
            </h2>
            <p className="text-slate-600">See all submitted survey answers</p>
          </button>
        </div>

        <div
          className="mt-12 text-center animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <p className="text-blue-200 text-sm">
            These views can be embedded as iframes in other websites
          </p>
        </div>
      </div>
    </div>
  );
}

export default MainPage;
