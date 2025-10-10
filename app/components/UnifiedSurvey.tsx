"use client";
import { useState, useEffect } from "react";
import {
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckIcon,
} from "lucide-react";
import { Question, UserInfo, airtableService } from "../services/airtable";

export default function UnifiedSurvey() {
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
  const [approvedAnswers, setApprovedAnswers] = useState<any[]>([]);
  const [filteredAnswers, setFilteredAnswers] = useState<any[]>([]);
  const [refreshingAnswers, setRefreshingAnswers] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [currentAnswerPage, setCurrentAnswerPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const CHARACTER_LIMIT = 1000;
  const ANSWERS_PER_PAGE = 4;

  useEffect(() => {
    loadQuestions();
    loadApprovedAnswers();
  }, []);

  useEffect(() => {
    // Update filtered answers when selected question changes
    if (selectedQuestion) {
      const filtered = approvedAnswers.filter(
        (answer) => answer.questionId === selectedQuestion
      );
      setFilteredAnswers(filtered);
    } else {
      setFilteredAnswers(approvedAnswers);
    }
    setCurrentAnswerPage(0); // Reset to first page when filter changes
  }, [selectedQuestion, approvedAnswers]);

  const loadQuestions = async () => {
    setLoading(true);
    const data = await airtableService.getQuestions();
    setQuestions(data);
    setLoading(false);
  };

  const loadApprovedAnswers = async () => {
    setRefreshingAnswers(true);
    try {
      const [questionsData, answersData] = await Promise.all([
        airtableService.getQuestions(),
        airtableService.getAnswers(),
      ]);

      const mergedAnswers = answersData.map((a) => {
        const q = questionsData.find((q) => q.id === a.questionId);
        return {
          ...a,
          order: q?.order ?? 999,
          questionNumber:
            questionsData.findIndex((q) => q.id === a.questionId) + 1,
          questionText: q?.question || "Unknown Question",
        };
      });

      const sorted = mergedAnswers.sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      setApprovedAnswers(sorted);
      setFilteredAnswers(sorted); // Initialize filtered answers with all answers
    } catch (error) {
      console.error("Error loading answers:", error);
    } finally {
      setRefreshingAnswers(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    if (value.length <= CHARACTER_LIMIT) {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
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

    if (success) {
      // Find next unanswered question
      const nextUnansweredIndex = questions.findIndex(
        (q, index) => index > currentIndex && !answers[q.id]?.trim()
      );

      if (nextUnansweredIndex !== -1) {
        // Go to next unanswered question
        setCurrentIndex(nextUnansweredIndex);
      } else {
        // If all questions are answered, go to first question
        setCurrentIndex(0);
      }

      // Reset form and show success
      setShowUserForm(false);
      setAnswers({});
      loadApprovedAnswers();

      // Show success message
      alert("Your response has been submitted successfully!");
    } else {
      alert("Failed to submit. Try again.");
    }
  };

  const handlePromptSubmit = async () => {
    if (!customPrompt.trim()) {
      alert("Please enter a prompt before submitting.");
      return;
    }

    // Here you can add logic to submit the custom prompt to your database
    console.log("Custom prompt submitted:", customPrompt);

    // Reset the form and go to first question
    setCustomPrompt("");
    setSubmitted(false);
    setShowUserForm(false);
    setAnswers({});
    setCurrentIndex(0);
  };

  const hasAnyAnswer = Object.values(answers).some(
    (ans) => ans.trim().length > 0
  );

  const getAllAnswers = () => {
    return filteredAnswers;
  };

  // Get paginated answers for slider
  const getPaginatedAnswers = () => {
    const startIndex = currentAnswerPage * ANSWERS_PER_PAGE;
    return getAllAnswers().slice(startIndex, startIndex + ANSWERS_PER_PAGE);
  };

  const totalAnswerPages = Math.ceil(getAllAnswers().length / ANSWERS_PER_PAGE);

  const nextAnswerPage = () => {
    setCurrentAnswerPage((prev) => (prev + 1) % totalAnswerPages);
  };

  const prevAnswerPage = () => {
    setCurrentAnswerPage(
      (prev) => (prev - 1 + totalAnswerPages) % totalAnswerPages
    );
  };

  // Function to handle question filter click
  const handleQuestionFilter = (questionId: string | null) => {
    setSelectedQuestion(questionId);
  };

  // Function to get truncated question text for badges
  const getTruncatedQuestion = (question: string, maxLength: number = 40) => {
    return question.length > maxLength
      ? question.substring(0, maxLength) + "..."
      : question;
  };

  return (
    <div className="min-h-screen w-full bg-[#133844] relative px-4 sm:px-6 md:px-10 py-6">
      <div className="relative w-full max-w-4xl mx-auto z-10">
        {/* Header with Logo */}
        <div className="flex flex-col mb-8">
          {/* <div className="flex items-center justify-center my-12">
            <img
              src="/logo.png"
              alt="Logo"
              style={{ width: "198px", height: "34px" }}
            />
          </div> */}
          <h1 className="text-[40px] font-bold mt-16 text-[#D7FDF5] font-georgia">
            Ready to prompt the future?
          </h1>
          <hr className="border-t-2 border-white/20 my-4" />
          <p className="mt-2 text-start text-[18px] font-normal text-[#D7FDF5] font-georgia">
            This is the start of a global discussion. Share your thoughts and
            see what others have to say.
          </p>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-white mx-auto mb-4"></div>
              <p className="text-white">Loading questions...</p>
            </div>
          </div>
        )}

        {/* QUESTIONS OR FORM */}
        {!loading && (
          <div className="space-y-8">
            {/* Main Content Card */}
            <div className="">
              {!showUserForm ? (
                <>
                  {/* Main Content Area with Black Text */}
                  <div className="bg-[#D7FDF5] rounded-2xl p-4 mb-6 border border-white/10 mt-4">
                    {/* Progress Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                      <span className="text-[14px] font-bold text-[#133844]  py-1 self-start sm:self-auto font-arial">
                        Prompt {currentIndex + 1} of {questions.length}
                      </span>
                      <div className="flex flex-wrap gap-1 justify-center sm:justify-end">
                        {questions.map((_, idx) => {
                          const isActive = idx === currentIndex;
                          const isAnswered = answers[questions[idx]?.id];
                          return (
                            <button
                              key={idx}
                              onClick={() => setCurrentIndex(idx)}
                              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                isActive
                                  ? "bg-[#133844] shadow-md"
                                  : isAnswered
                                  ? "bg-[#133844] opacity-60 shadow-sm"
                                  : "bg-[#133844] opacity-30 shadow-inner hover:opacity-50"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="mb-6">
                      <h2 className="text-[14px] font-normal text-[#133844] text-start font-georgia">
                        {questions[currentIndex]?.question}
                      </h2>
                    </div>
                    <hr className="border-t-1 border-[#133844]" />

                    {/* Answer Input Box with Submit Icon */}
                    <div className="relative">
                      <div className="p-1 relative">
                        <textarea
                          value={answers[questions[currentIndex]?.id] || ""}
                          onChange={(e) =>
                            handleAnswerChange(
                              questions[currentIndex]?.id,
                              e.target.value
                            )
                          }
                          placeholder="Type your prompt here..."
                          className="w-full h-32 sm:h-40 p-4 cursor-pointer text-[#133844] placeholder-[#133844]/60 resize-none outline-none text-lg"
                        />
                      </div>

                      {/* Counter and Submit Icon aligned */}
                      <div className="flex justify-between items-center mt-2 px-1">
                        <div className="text-sm text-[#133844]">
                          {answers[questions[currentIndex]?.id]?.length || 0} /{" "}
                          {CHARACTER_LIMIT}
                        </div>

                        <button
                          onClick={() => setShowUserForm(true)}
                          disabled={!hasAnyAnswer}
                          className="p-2"
                        >
                          <Check
                            className={`w-6 h-6 transition-all duration-300 cursor-pointer ${
                              hasAnyAnswer
                                ? "text-[#133844] hover:text-[#0a2129] cursor-pointer"
                                : "text-gray-400 cursor-not-allowed"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Community Responses - Slider Style */}
                  <div className="mt-8">
                    {/* Slider Container */}
                    <div className="">
                      {/* Answers Slider */}
                      <div className="relative">
                        {/* Answers List - Fixed Height */}
                        <div className="space-y-0 h-84 overflow-y-auto">
                          {getPaginatedAnswers().length > 0 ? (
                            getPaginatedAnswers().map((answer, index) => (
                              <div
                                key={answer.id}
                                className="p-4 border-b-[0.5] border-white last:border-b-0"
                              >
                                {/* Answer Text */}
                                <p className="text-[#D7FDF5] font-normal text-[14px] mb-2 font-georgia ">
                                  {answer.answer}
                                </p>

                                {/* User Info - Country and Date */}
                                <div className="text-[14px] text-[#D7FDF5] font-bold flex justify-between font-arial">
                                  <span>
                                    {answer.userName
                                      ? answer.userName
                                          .split(" ")
                                          .map(
                                            (
                                              word: any,
                                              index: any,
                                              array: any
                                            ) =>
                                              index === 0
                                                ? word
                                                : index === 1 &&
                                                  array.length > 1
                                                ? word.charAt(0) + "."
                                                : ""
                                          )
                                          .join(" ")
                                          .trim()
                                      : "Anonymous"}
                                  </span>
                                  <span className="text-[14px] font-bold text-[#133844] bg-[#D7FDF5] px-2 py-1 rounded-full font-arial">
                                    Topic {answer.questionNumber || "?"}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-white/60 h-full flex items-center justify-center">
                              <div>
                                <p>No responses yet.</p>
                                <p className="text-[14px] mt-2">
                                  Be the first to share your thoughts!
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Slider Dots */}
                        {totalAnswerPages > 1 && (
                          <div className="flex justify-center gap-3 mt-4 pt-4">
                            {Array.from(
                              { length: totalAnswerPages },
                              (_, i) => (
                                <button
                                  key={i}
                                  onClick={() => setCurrentAnswerPage(i)}
                                  className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer ${
                                    i === currentAnswerPage
                                      ? "bg-white shadow-lg scale-110"
                                      : "bg-white/30 shadow-inner hover:bg-white/50 border border-white/20"
                                  }`}
                                />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Question Filter Badges */}
                  <div className="mb-6 mt-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[14px] font-bold font-arial text-[#D7FDF5]">
                        View by topic
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* All Questions Badge */}
                      <button
                        onClick={() => handleQuestionFilter(null)}
                        className={`px-4 py-2 rounded-full text-[14px] font-normal font-arial cursor-pointer transition-all duration-300 ${
                          selectedQuestion === null
                            ? "bg-white text-[#133844] shadow-lg"
                            : "bg-[#8EE8D8] text-[#133844]"
                        }`}
                      >
                        All Questions
                      </button>

                      {/* Individual Question Badges */}
                      {questions.map((question) => (
                        <button
                          key={question.id}
                          onClick={() => handleQuestionFilter(question.id)}
                          className={`px-4 py-2 rounded-full text-[14px] cursor-pointer font-normal font-arial transition-all duration-300 ${
                            selectedQuestion === question.id
                              ? "bg-white text-[#133844] shadow-lg"
                              : "bg-[#8EE8D8] text-[#133844]"
                          }`}
                        >
                          {question.question}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                // USER FORM
                <>
                  {/* User Info - Separate Boxes */}
                  <div className="space-y-4 mb-8 bg-[#D7FDF5] text-black p-6 rounded-2xl border border-white/10">
                    <div className="text-start text-black">
                      <h2 className="text-[14px] font-arial font-bold text-[#133844] mb-1">
                        Almost Done!
                      </h2>
                      <p className="text-[12px] font-normal font-georgia text-[#133844]">
                        Please provide your details
                      </p>
                      <p className="text-[12px] font-normal font-georgia text-[#133844]">
                        to complete the submission
                      </p>
                    </div>
                    {/* Full Name */}
                    <div>
                      <label className="block text-[12px] font-normal font-georgia text-[#133844] mb-1 ml-1">
                        Full name
                      </label>
                      <input
                        type="text"
                        value={userInfo.name}
                        onChange={(e) =>
                          setUserInfo({ ...userInfo, name: e.target.value })
                        }
                        className="w-full p-2 bg-transparent text-black placeholder-black/60 outline-none text-lg border-b-2 border-black/30"
                      />
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-[12px] font-normal font-georgia text-[#133844] mb-1 ml-1">
                        Email address
                      </label>
                      <div className="border-b-2 border-black/30 pb-1">
                        <input
                          type="email"
                          value={userInfo.email}
                          onChange={(e) =>
                            setUserInfo({ ...userInfo, email: e.target.value })
                          }
                          className="w-full p-2 bg-transparent text-black placeholder-black/60 outline-none text-lg"
                        />
                      </div>
                    </div>

                    {/* Country */}
                    <div>
                      <label className="block text-[12px] font-normal font-georgia text-[#133844] mb-1 ml-1">
                        Country
                      </label>
                      <div className="border-b-2 border-black/30 pb-1">
                        <input
                          type="text"
                          value={userInfo.country}
                          onChange={(e) =>
                            setUserInfo({
                              ...userInfo,
                              country: e.target.value,
                            })
                          }
                          className="w-full p-2 bg-transparent text-black placeholder-black/60 outline-none text-lg"
                        />
                      </div>
                    </div>

                    {/* GDPR Consent */}
                    <div className="flex items-start gap-3">
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
                        className="w-4 h-4 mt-0.5 text-blue-600 border-black/30 rounded focus:ring-black/50 bg-white"
                      />
                      <label
                        htmlFor="gdpr"
                        className="text-[12px] font-normal font-georgia text-[#133844] leading-relaxed text-left"
                      >
                        Check this box if you're willing for us to
                        <br />
                        use your responses in future campaigns
                      </label>
                    </div>
                  </div>
                  {/* Form Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/20">
                    <button
                      onClick={() => setShowUserForm(false)}
                      className="flex-1 py-4 text-white cursor-pointer hover:text-white/90 transition-all font-semibold text-lg border border-white/30 rounded-2xl hover:bg-white/10"
                    >
                      Back to Questions
                    </button>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !userInfo.gdprConsent}
                      className="flex-1 py-4 bg-emerald-500 text-white cursor-pointer rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-all font-semibold text-lg border border-emerald-400/30"
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
