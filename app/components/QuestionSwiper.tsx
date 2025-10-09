"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Question, UserInfo, airtableService } from "../services/airtable";

export default function QuestionSwiper() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showUserForm, setShowUserForm] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: "",
    email: "",
    country: "",
    gdprConsent: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("right");

  const CHARACTER_LIMIT = 1000;

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    const data = await airtableService.getQuestions();
    setQuestions(data);
    setLoading(false);
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    if (value.length <= CHARACTER_LIMIT) {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setDirection("right");
      setTimeout(() => setCurrentIndex(currentIndex + 1), 50);
    }
  };

  const handlePrevious = () => {
    if (showUserForm) {
      setDirection("left");
      setTimeout(() => setShowUserForm(false), 50);
    } else if (currentIndex > 0) {
      setDirection("left");
      setTimeout(() => setCurrentIndex(currentIndex - 1), 50);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const answersArray = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({
        questionId: q.id,
        question: q.question,
        answer: answers[q.id],
      }));

    if (answersArray.length === 0) {
      alert("Please answer at least one question before submitting.");
      setSubmitting(false);
      return;
    }

    const success = await airtableService.submitAnswers(answersArray, userInfo);
    setSubmitting(false);

    if (success) setSubmitted(true);
    else alert("Failed to submit. Try again.");
  };

  const hasAnyAnswer = Object.values(answers).some(
    (ans) => ans.trim().length > 0
  );

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat relative px-4 sm:px-6 md:px-10 py-10"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-slate-100/40 to-blue-100/60 backdrop-blur-sm"></div>

      <div className="relative w-full max-w-3xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl z-10">
        {/* LOADING */}
        {loading && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-slate-800 mx-auto mb-4"></div>
            </div>
          </div>
        )}

        {/* THANK YOU */}
        {!loading && submitted && (
          <div className="flex items-center justify-center min-h-[70vh] animate-fade-in px-4">
            <div className="text-center bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 border border-white/40">
              <div className="bg-emerald-100 rounded-full w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
                Thank You!
              </h2>
              <p className="text-slate-700 text-base sm:text-lg">
                Your responses have been submitted successfully.
              </p>
            </div>
          </div>
        )}

        {/* QUESTIONS OR FORM */}
        {!loading && !submitted && (
          <>
            {!showUserForm ? (
              <div
                key={currentIndex}
                className={`animate-slide-${direction} bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 border border-white/40`}
              >
                {/* Progress */}
                <div className="mb-6 sm:mb-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4 sm:gap-0">
                    <span className="text-sm font-semibold text-blue-700 bg-blue-100/70 px-4 py-1.5 rounded-full self-start sm:self-auto">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                      {questions.map((_, idx) => {
                        const isActive = idx === currentIndex;
                        const isAnswered = answers[questions[idx]?.id];
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setDirection(
                                idx > currentIndex ? "right" : "left"
                              );
                              setCurrentIndex(idx);
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isActive
                                ? "bg-gradient-to-r from-blue-600 to-blue-400 w-10 sm:w-12 shadow-md"
                                : isAnswered
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 w-8 shadow-sm"
                                : "bg-slate-300 w-8 shadow-inner hover:bg-slate-400/80"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6 text-center sm:text-left">
                    {questions[currentIndex]?.question}
                  </h2>

                  <div className="relative">
                    <textarea
                      value={answers[questions[currentIndex]?.id] || ""}
                      onChange={(e) =>
                        handleAnswerChange(
                          questions[currentIndex]?.id,
                          e.target.value
                        )
                      }
                      placeholder="Type your answer here..."
                      className="w-full h-36 sm:h-40 p-3 sm:p-4 border-2 border-slate-200/70 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-slate-800 resize-none text-base sm:text-lg bg-white/70"
                    />
                    <div className="text-right text-sm text-slate-600 mt-1">
                      {answers[questions[currentIndex]?.id]?.length || 0} /{" "}
                      {CHARACTER_LIMIT}
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-100/60 gap-4 sm:gap-0">
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-2 px-4 sm:px-6 py-3 text-slate-700 hover:text-slate-900 disabled:opacity-30 transition-all font-semibold text-sm sm:text-base"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Previous
                  </button>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleNext}
                      disabled={currentIndex === questions.length - 1}
                      className={`flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-xl transition-all font-semibold shadow-lg text-sm sm:text-base ${
                        currentIndex === questions.length - 1
                          ? "bg-gray-400 text-white cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      Next <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                      onClick={() => setShowUserForm(true)}
                      disabled={!hasAnyAnswer}
                      className={`flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-xl transition-all font-semibold shadow-lg text-sm sm:text-base ${
                        hasAnyAnswer
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-gray-300 text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Submit <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // USER FORM
              <div
                className={`animate-slide-${direction} bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 border border-white/40`}
              >
                <div className="mb-6 sm:mb-8 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">
                    Almost Done!
                  </h2>
                  <p className="text-slate-700 text-base sm:text-lg">
                    Please provide your details to complete the submission.
                  </p>
                </div>

                {/* User Info */}
                <div className="space-y-5 sm:space-y-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={userInfo.name}
                      onChange={(e) =>
                        setUserInfo({ ...userInfo, name: e.target.value })
                      }
                      placeholder="John Doe"
                      className="w-full p-3 sm:p-4 border-2 border-slate-200/70 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-slate-800 bg-white/70 text-sm sm:text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={userInfo.email}
                      onChange={(e) =>
                        setUserInfo({ ...userInfo, email: e.target.value })
                      }
                      placeholder="john@example.com"
                      className="w-full p-3 sm:p-4 border-2 border-slate-200/70 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-slate-800 bg-white/70 text-sm sm:text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={userInfo.country}
                      onChange={(e) =>
                        setUserInfo({ ...userInfo, country: e.target.value })
                      }
                      placeholder="United States"
                      className="w-full p-3 sm:p-4 border-2 border-slate-200/70 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-slate-800 bg-white/70 text-sm sm:text-base"
                    />
                  </div>

                  <div className="flex items-start gap-3 p-3 sm:p-4 bg-slate-50/60 rounded-xl">
                    <input
                      type="checkbox"
                      id="gdpr"
                      checked={userInfo.gdprConsent}
                      onChange={(e) =>
                        setUserInfo({
                          ...userInfo,
                          gdprConsent: e.target.checked,
                        })
                      }
                      className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="gdpr"
                      className="text-sm text-slate-800 leading-relaxed"
                    >
                      GDPR message / Terms and Conditions.
                    </label>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-100/60 gap-4 sm:gap-0">
                  <button
                    onClick={handlePrevious}
                    className="flex items-center gap-2 px-4 sm:px-6 py-3 text-slate-700 hover:text-slate-900 transition-all font-semibold text-sm sm:text-base"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back
                  </button>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all font-semibold shadow-lg text-sm sm:text-base"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
