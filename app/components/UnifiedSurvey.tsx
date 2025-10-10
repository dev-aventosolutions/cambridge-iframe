"use client";
import { useState, useEffect, useRef } from "react";
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
  const [showThankYou, setShowThankYou] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: "",
    email: "",
    organization: "",
    country: "",
    gdprConsent: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingCustomPrompt, setSubmittingCustomPrompt] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approvedAnswers, setApprovedAnswers] = useState<any[]>([]);
  const [filteredAnswers, setFilteredAnswers] = useState<any[]>([]);
  const [refreshingAnswers, setRefreshingAnswers] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [currentAnswerPage, setCurrentAnswerPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // NEW: Store the record IDs of submitted answers
  const [submittedRecordIds, setSubmittedRecordIds] = useState<string[]>([]);

  const CHARACTER_LIMIT = 1000;
  const ANSWERS_PER_PAGE = 4;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const thumbRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScrollClick = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
    scrollRef.current.scrollTo({
      left: scrollLeft + scrollAmount,
      behavior: "smooth",
    });
  };

  // Add validation function
  const validateUserInfo = (): boolean => {
    if (!userInfo.name.trim()) {
      alert("Please enter your full name.");
      return false;
    }
    
    if (!userInfo.email.trim()) {
      alert("Please enter your email address.");
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userInfo.email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    
    if (!userInfo.gdprConsent) {
      alert("Please agree to the privacy policy by checking the GDPR consent box.");
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    const c = containerRef.current;
    const thumb = thumbRef.current;
    if (!c || !thumb) return;

    const MIN_THUMB_HEIGHT = 50;
    const update = () => {
      const clientH = c.clientHeight;
      const scrollH = c.scrollHeight;
      const scrollTop = c.scrollTop;

      let thumbH = Math.max(MIN_THUMB_HEIGHT, (clientH / scrollH) * clientH);
      thumbH = Math.min(clientH, thumbH);
      thumb.style.height = `${thumbH}px`;

      const maxScroll = Math.max(0, scrollH - clientH);
      const maxThumbTop = Math.max(0, clientH - thumbH);
      const thumbTop =
        maxScroll === 0 ? 0 : (scrollTop / maxScroll) * maxThumbTop;
      thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    update();

    c.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const ro = new MutationObserver(update);
    ro.observe(c, { childList: true, subtree: true });

    return () => {
      c.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [filteredAnswers]);

  useEffect(() => {
    loadQuestions();
    loadApprovedAnswers();
  }, []);

  useEffect(() => {
    if (selectedQuestion) {
      const filtered = approvedAnswers.filter(
        (answer) => answer.questionId === selectedQuestion
      );
      setFilteredAnswers(filtered);
    } else {
      setFilteredAnswers(approvedAnswers);
    }
    setCurrentAnswerPage(0);
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

      const approvedAnswersData = answersData.filter(
        (answer) => answer.status === "Approved"
      );

      const mergedAnswers = approvedAnswersData.map((a) => {
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
      setFilteredAnswers(sorted);
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
    if (isSubmitting) return;
    
    // Validate user info before submitting
    if (!validateUserInfo()) {
      return;
    }
    
    setIsSubmitting(true);
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
      setIsSubmitting(false);
      return;
    }

    console.log("Submitting answers array:", answersArray);
    const result = await airtableService.submitAnswers(answersArray, userInfo);
    setSubmitting(false);
    setIsSubmitting(false);

    if (result.success) {
      // Store the record IDs for later use with custom prompt
      if (result.recordIds) {
        setSubmittedRecordIds(result.recordIds);
      }
      
      setHasSubmittedBefore(true);
      setShowUserForm(false);
      setShowThankYou(true);
      setAnswers({});
      loadApprovedAnswers();
    } else {
      alert("Failed to submit. Try again.");
    }
  };

  const handleDirectSubmit = async () => {
    if (isSubmitting) return;
    
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !answers[currentQuestion.id]?.trim()) {
      alert("Please write an answer before submitting.");
      return;
    }

    // For direct submit, we need to check if we have user info already
    if (!hasSubmittedBefore || !userInfo.gdprConsent) {
      // If user hasn't submitted before or doesn't have GDPR consent, show form
      setShowUserForm(true);
      return;
    }

    // Validate user info for direct submit
    if (!validateUserInfo()) {
      setShowUserForm(true); // Show form so they can fix the info
      return;
    }

    setIsSubmitting(true);
    setSubmitting(true);

    const answerData = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      answer: answers[currentQuestion.id],
    };

    console.log("Submitting single answer:", answerData);
    const result = await airtableService.submitSingleAnswer(answerData, userInfo);
    setSubmitting(false);
    setIsSubmitting(false);

    if (result.success) {
      // Store the record ID for later use with custom prompt
      if (result.recordId) {
        setSubmittedRecordIds([result.recordId]);
      }
      
      setHasSubmittedBefore(true);
      setShowThankYou(true);

      // Clear current answer
      setAnswers((prev) => {
        const newAnswers = { ...prev };
        delete newAnswers[currentQuestion.id];
        return newAnswers;
      });
      
      loadApprovedAnswers();
    } else {
      alert("Failed to submit. Try again.");
    }
  };

  const handleCustomPromptSubmit = async () => {
    if (!customPrompt.trim()) {
      alert("Please enter a prompt before submitting.");
      return;
    }

    setSubmittingCustomPrompt(true);

    try {
      let success = false;
      
      // Update ALL previously submitted records with the custom prompt
      if (submittedRecordIds.length > 0) {
        // Update all records with the same custom prompt
        const updatePromises = submittedRecordIds.map(recordId =>
          airtableService.updateAnswerWithCustomPrompt(recordId, customPrompt)
        );
        
        const results = await Promise.all(updatePromises);
        success = results.every(result => result === true);
        
        console.log(`Updated ${submittedRecordIds.length} records with custom prompt`);
      } else {
        // Fallback: create a new record if no previous records found
        console.warn("No previous records found, creating new record for custom prompt");
        success = await airtableService.submitCustomPrompt(customPrompt, userInfo);
      }

      if (success) {
        setShowThankYou(false);
        setCustomPrompt("");
        setSubmittedRecordIds([]); // Reset record IDs

        const currentQuestionId = questions[currentIndex]?.id;
        let nextIndex = -1;

        if (currentQuestionId) {
          const currentQuestionIndex = questions.findIndex(
            (q) => q.id === currentQuestionId
          );

          for (let i = currentQuestionIndex + 1; i < questions.length; i++) {
            if (!answers[questions[i].id]?.trim()) {
              nextIndex = i;
              break;
            }
          }

          if (nextIndex === -1) {
            for (let i = 0; i < questions.length; i++) {
              if (!answers[questions[i].id]?.trim()) {
                nextIndex = i;
                break;
              }
            }
          }
        }

        if (nextIndex !== -1) {
          setCurrentIndex(nextIndex);
          setTimeout(() => {
            if (scrollRef.current) {
              const cardWidth = scrollRef.current.clientWidth;
              scrollRef.current.scrollTo({
                left: nextIndex * cardWidth,
                behavior: "smooth",
              });
            }
          }, 100);
        } else {
          setCurrentIndex(0);
          if (scrollRef.current) {
            scrollRef.current.scrollTo({
              left: 0,
              behavior: "smooth",
            });
          }
        }

        alert("Your custom prompt has been submitted successfully!");
      } else {
        alert("Failed to submit custom prompt. Try again.");
      }
    } catch (error) {
      console.error("Error submitting custom prompt:", error);
      alert("Failed to submit custom prompt. Try again.");
    } finally {
      setSubmittingCustomPrompt(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const hasAnyAnswer = Object.values(answers).some(
    (ans) => ans.trim().length > 0
  );

  const getAllAnswers = () => {
    return filteredAnswers;
  };

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

  const handleQuestionFilter = (questionId: string | null) => {
    setSelectedQuestion(questionId);
  };

  return (
    <div
      className="min-h-screen w-full bg-fill relative px-4 sm:px-6 md:px-10 py-6
             bg-[url('/web.jpg')] md:bg-[url('/web.jpg')]"
    >
      <div className="relative w-full max-w-4xl mx-auto z-10">
        {/* Header with Logo */}
        <div className="flex flex-col mb-8">
          <h1 className="md:text-[40px] text-[20px] md:mt-0 font-bold mt-12 text-[#133844] font-serif">
            Ready to prompt the future?
          </h1>
          <p className="mt-2 text-start text-[18px] font-normal text-[#133844] font-open-sans">
            This is the start of a global discussion. Share your thoughts and
            see what others have to say.
          </p>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin test-[#00BDB6] rounded-full h-14 w-14 border-b-4 border-[#00BDB6] mx-auto mb-4"></div>
            </div>
          </div>
        )}

        {/* QUESTIONS OR FORM */}
        {!loading && (
          <div className="space-y-8">
            {/* Main Content Card */}
            <div className="">
              {/* PROMPT CARDS SLIDER OR USER FORM OR THANK YOU */}
              <div className="mb-6">
                <div className="mb-6 relative">
                  {/* Scroll Buttons - Only show when on question cards (not user form or thank you) */}
                  {!showUserForm && !showThankYou && (
                    <>
                      <button
                        onClick={() => handleScrollClick("left")}
                        className="absolute -left-12 top-1/2 -translate-y-1/2 z-[100] bg-white/70 hover:bg-white text-[#133844] shadow-md rounded-full p-2 transition-all md:block hidden"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => handleScrollClick("right")}
                        className="absolute right-12 top-1/2 -translate-y-1/2 z-20 bg-white/70 hover:bg-white text-[#133844] shadow-md rounded-full p-2 transition-all md:block hidden"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Scrollable Cards Container */}
                  <div
                    ref={scrollRef}
                    className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth gap-4 pb-4 hide-scrollbar"
                  >
                    {showUserForm ? (
                      // USER FORM
                      <div className="flex-shrink-0 w-[85vw] sm:w-[70vw] md:w-[55vw] lg:w-[45vw] xl:w-[35vw] bg-[#D7FDF5] rounded-2xl p-4 border border-white/10">
                        <div className="flex-shrink-0 w-full bg-white/20 backdrop-blur-[30px] rounded-2xl p-4 border border-white/40 shadow-[0_4px_16px_0_rgba(19,56,68,0.1)]">
                          <div className="space-y-4">
                            

                            <div className="mb-6">
                              <h2 className="text-[14px] font-normal text-[#000000] text-start font-serif">
                                Please provide your details to complete the submission.
                              </h2>
                            </div>
                            <hr className="border-t-1 border-[#133844]" />

                            <div className="space-y-6">
                              {/* Form fields */}
                              <div>
                                <input
                                  type="text"
                                  value={userInfo.name}
                                  onChange={(e) =>
                                    setUserInfo({
                                      ...userInfo,
                                      name: e.target.value,
                                    })
                                  }
                                  className="w-full p-2 bg-transparent text-[#000000] placeholder-[#000000]/60 outline-none text-lg border-b-2 border-[#133844]/30"
                                  placeholder="Enter Full Name *"
                                />
                              </div>

                              <div>
                                <input
                                  type="email"
                                  value={userInfo.email}
                                  onChange={(e) =>
                                    setUserInfo({
                                      ...userInfo,
                                      email: e.target.value,
                                    })
                                  }
                                  className="w-full p-2 bg-transparent text-[#000000] placeholder-[#000000]/60 outline-none text-lg border-b-2 border-[#133844]/30"
                                  placeholder="Enter Email *"
                                />
                              </div>

                              <div>
                                <input
                                  type="text"
                                  value={userInfo.country}
                                  onChange={(e) =>
                                    setUserInfo({
                                      ...userInfo,
                                      country: e.target.value,
                                    })
                                  }
                                  className="w-full p-2 bg-transparent text-[#000000] placeholder-[#000000]/60 outline-none text-lg border-b-2 border-[#133844]/30"
                                  placeholder="Enter Country"
                                />
                              </div>

                              <div>
                                <input
                                  type="text"
                                  value={userInfo.organization}
                                  onChange={(e) =>
                                    setUserInfo({
                                      ...userInfo,
                                      organization: e.target.value,
                                    })
                                  }
                                  className="w-full p-2 bg-transparent text-[#000000] placeholder-[#000000]/60 outline-none text-lg border-b-2 border-[#133844]/30"
                                  placeholder="Organization"
                                />
                              </div>

                              <div className="flex items-start gap-3 pt-2">
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
                                  className="custom-checkbox mt-0.5"
                                />
                                <label
                                  htmlFor="gdpr"
                                  className="text-[12px] font-normal font-serif text-[#000000] leading-relaxed text-left mt-1"
                                >
                                  By clicking submit, you agree to our privacy
                                  policy. *
                                </label>
                              </div>
                            </div>

                            <div className="flex justify-end pt-6">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!submitting && !isSubmitting)
                                    handleSubmit();
                                }}
                                disabled={submitting || isSubmitting}
                                className={`transition-all ${
                                  submitting || isSubmitting
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <img
                                  src="/finish.svg"
                                  alt="Submit"
                                  className="w-[22px] h-[20px] pointer-events-none"
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : showThankYou ? (
                      // THANK YOU
                      <div className="flex-shrink-0 w-[85vw] sm:w-[70vw] md:w-[55vw] lg:w-[45vw] xl:w-[35vw] bg-white/20 backdrop-blur-[30px] rounded-2xl p-4 border border-white/40 shadow-[0_4px_16px_0_rgba(19,56,68,0.1)]">
                        <div className="flex items-center justify-start mb-6">
                          <span className="text-[14px] font-bold text-[#000000] font-open-sans">
                            Thank You!
                          </span>
                        </div>

                        <div className="mb-6">
                          <h2 className="text-[14px] font-normal text-[#000000] text-start font-serif">
                            THANK YOU FOR YOUR ANSWERS
                          </h2>
                          <p className="text-[14px] font-normal text-[#000000] text-start font-serif mt-4">
                            Do you have a prompt of your own that you would like the world to answer?
                          </p>
                        </div>
                        <hr className="border-t-1 border-[#133844]" />

                        <div className="relative">
                          <div className="p-1 relative">
                            <textarea
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              placeholder="Type your answer here"
                              className="w-full h-32 sm:h-40 p-4 text-[#000000] placeholder-[#000000] resize-none outline-none text-lg"
                            />
                          </div>

                          <div className="flex justify-between items-center mt-2 px-1">
                            <div className="text-sm text-[#133844]">
                              {customPrompt.length} / {CHARACTER_LIMIT}
                            </div>

                            <button
                              onClick={handleCustomPromptSubmit}
                              disabled={
                                !customPrompt.trim() || submittingCustomPrompt
                              }
                              className="p-2"
                            >
                              <img
                                src="/finish.svg"
                                alt="Submit"
                                className={`w-6 h-6 transition-all duration-300 ${
                                  customPrompt.trim() && !submittingCustomPrompt
                                    ? "cursor-pointer hover:opacity-80"
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // PROMPT CARDS
                      questions.map((question, index) => (
                        <div
                          key={question.id}
                          className={`flex-shrink-0 w-[85vw] sm:w-[70vw] md:w-[55vw] lg:w-[45vw] xl:w-[35vw]
                bg-white/20 backdrop-blur-[30px] border border-white/40 rounded-2xl p-4 snap-center
                shadow-[0_4px_16px_0_rgba(19,56,68,0.1)]
                ${index === currentIndex ? "ring-2 ring-white/30" : ""}`}
                        >
                          <div className="">
                            

                            <span className="text-[14px] font-bold text-[#000000] font-open-sans">
                              PROMPT {index + 1}
                            </span>

                           
                          </div>

                          <div className="mb-6">
                            <h2 className="text-[14px] font-normal text-[#000000] text-start font-serif mt-2">
                              {question.question}
                            </h2>
                          </div>
                          <hr className="border-t-1 border-[#133844]" />

                          <div className="relative">
  <div className="p-1 relative">
    <div className="relative">
      <textarea
        value={answers[question.id] || ""}
        onChange={(e) =>
          handleAnswerChange(
            question.id,
            e.target.value
          )
        }
        placeholder="Type your answer here..."
        className="w-full h-32 sm:h-40 px-0 py-4 text-[#000000] placeholder-[#000000] resize-none outline-none text-[18px] font-normal pl-2 font-open-sans"
      />
      <div className="absolute -left-1 top-4 w-[1px] h-[25px] bg-[#133844]"></div>
    </div>
  </div>

  <div className="flex justify-between items-center mt-2 px-1">
    <div className="text-sm text-[#133844]">
      {answers[question.id]?.length || 0} /{" "}
      {CHARACTER_LIMIT}
    </div>

    <button
      onClick={() => {
        if (
          hasSubmittedBefore &&
          userInfo.gdprConsent
        ) {
          handleDirectSubmit();
        } else {
          setShowUserForm(true);
        }
      }}
      disabled={!answers[question.id]?.trim() || isSubmitting}
      className="p-2"
    >
      <img
        src="/finish.svg"
        alt="Submit"
        className={`w-6 h-6 transition-all duration-300 ${
          answers[question.id]?.trim() && !isSubmitting
            ? "cursor-pointer hover:opacity-80"
            : "opacity-50 cursor-not-allowed"
        }`}
      />
    </button>
  </div>
</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Rest of the component remains the same */}
              <div className="lg:flex lg:gap-6">
                {/* LEFT COLUMN - FILTERS (30%) */}
                <div className="lg:w-[30%] mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-bold font-open-sans text-[#133844]">
                      View by prompt
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {questions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => handleQuestionFilter(question.id)}
                        className={`px-3 py-2 rounded-full text-[12px] cursor-pointer font-normal font-open-sans transition-all duration-300 ${
                          selectedQuestion === question.id
                            ? "bg-[#133844] text-[#FFFFFF] shadow-lg"
                            : "bg-[#00BDB6] text-[#FFFFFF]"
                        }`}
                      >
                        Prompt {index + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RIGHT COLUMN - COMMUNITY RESPONSES (70%) */}
                <div className="lg:w-[70%] mb-12 md:mb-0 relative">
                  <div
                    ref={containerRef}
                    className="space-y-0 h-84 overflow-y-auto custom-scrollbar hide-native-scrollbar  pr-8 md:pr-14"
                  >
                    <div className="absolute h-84 w-[5px] bg-[#00BDB6]/20 right-[5px] hover:right-[8px] -z-3" />
                    {filteredAnswers.length > 0 ? (
                      filteredAnswers.map((answer, index) => (
                        <div
                          key={answer.id}
                          className="px-0 py-4 border-b-[0.5] border-[#133844] last:border-b-0"
                        >
                          <p className="text-[#133844] font-normal text-[14px] mb-2 font-serif ">
                            {answer.answer}
                          </p>
                          
                          <div className="text-[14px] text-[#133844] font-bold flex justify-between font-open-sans">
                            <span>
                              {answer.userName
                                ? answer.userName
                                    .split(" ")
                                    .map((word: any, index: any, array: any) =>
                                      index === 0
                                        ? word
                                        : index === 1 && array.length > 1
                                        ? word.charAt(0) + "."
                                        : ""
                                    )
                                    .join(" ")
                                    .trim()
                                : "Anonymous"}
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
                  <div className="custom-thumb" ref={thumbRef} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}