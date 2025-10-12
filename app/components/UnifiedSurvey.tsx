"use client";
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
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

  const [submittedRecordIds, setSubmittedRecordIds] = useState<string[]>([]);

  const CHARACTER_LIMIT = 1000;
  const ANSWERS_PER_PAGE = 4;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const thumbRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentIndexRef = useRef(0);

  const isManualScrollRef = useRef(false);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const handleScrollClick = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const container = scrollRef.current;
    const cardWidth = container.clientWidth * 0.85;
    const gap = 16;
    const totalCardWidth = cardWidth + gap;

    let newScrollLeft;

    if (direction === "left") {
      newScrollLeft = container.scrollLeft - totalCardWidth;
    } else {
      newScrollLeft = container.scrollLeft + totalCardWidth;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    let boundedScrollLeft;
    if (direction === "left" && newScrollLeft < 0) {
      boundedScrollLeft = 0;
    } else if (direction === "right" && newScrollLeft > maxScrollLeft) {
      boundedScrollLeft = maxScrollLeft;
    } else {
      boundedScrollLeft = newScrollLeft;
    }

    isManualScrollRef.current = true;

    container.scrollTo({
      left: boundedScrollLeft,
      behavior: "smooth",
    });

    const newIndex = Math.round(boundedScrollLeft / totalCardWidth);
    if (
      newIndex !== currentIndex &&
      newIndex >= 0 &&
      newIndex < questions.length
    ) {
      setCurrentIndex(newIndex);
    }

    setTimeout(() => {
      isManualScrollRef.current = false;
    }, 500);
  };

  const validateUserInfo = (): boolean => {
    if (!userInfo.name.trim()) {
      alert("Please enter your full name.");
      return false;
    }

    if (!userInfo.email.trim()) {
      alert("Please enter your email address.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userInfo.email)) {
      alert("Please enter a valid email address.");
      return false;
    }

    if (!userInfo.gdprConsent) {
      alert(
        "Please agree to the privacy policy by checking the GDPR consent box."
      );
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
    if (questions.length > 0 && !selectedQuestion) {
      setSelectedQuestion(questions[0].id);
    }
  }, [questions, selectedQuestion]);

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

      if (questionsData.length > 0) {
        const prompt1Id = questionsData[0].id;
        const prompt1Answers = sorted.filter(
          (answer) => answer.questionId === prompt1Id
        );
        setFilteredAnswers(prompt1Answers);
      } else {
        setFilteredAnswers(sorted);
      }
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
      if (result.recordIds) {
        setSubmittedRecordIds(result.recordIds);
      }

      setHasSubmittedBefore(true);
      setShowUserForm(false);
      setShowThankYou(true);
      setAnswers({});
      loadApprovedAnswers();

      const currentIdx = currentIndexRef.current;
      const nextIndex = (currentIdx + 1) % questions.length;
      console.log(
        `Form submit: Navigating from question ${currentIdx + 1} to question ${
          nextIndex + 1
        }`
      );
      setCurrentIndex(nextIndex);
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

    if (!hasSubmittedBefore || !userInfo.gdprConsent) {
      setShowUserForm(true);
      return;
    }

    if (!validateUserInfo()) {
      setShowUserForm(true);
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
    const result = await airtableService.submitSingleAnswer(
      answerData,
      userInfo
    );
    setSubmitting(false);
    setIsSubmitting(false);

    if (result.success) {
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

      const currentIdx = currentIndexRef.current;
      const nextIndex = (currentIdx + 1) % questions.length;
      console.log(
        `Direct submit: Navigating from question ${
          currentIdx + 1
        } to question ${nextIndex + 1}`
      );
      setCurrentIndex(nextIndex);
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

      if (submittedRecordIds.length > 0) {
        const updatePromises = submittedRecordIds.map((recordId) =>
          airtableService.updateAnswerWithCustomPrompt(recordId, customPrompt)
        );

        const results = await Promise.all(updatePromises);
        success = results.every((result) => result === true);

        console.log(
          `Updated ${submittedRecordIds.length} records with custom prompt`
        );
      } else {
        console.warn(
          "No previous records found, creating new record for custom prompt"
        );
        success = await airtableService.submitCustomPrompt(
          customPrompt,
          userInfo
        );
      }

      if (success) {
        setShowThankYou(false);
        setCustomPrompt("");
        setSubmittedRecordIds([]);

        const currentIdx = currentIndexRef.current;
        const nextIndex = (currentIdx + 1) % questions.length;
        console.log(
          `Custom prompt: Navigating from question ${
            currentIdx + 1
          } to question ${nextIndex + 1}`
        );
        setCurrentIndex(nextIndex);

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

  const handleCloseThankYou = () => {
    setShowThankYou(false);
    setCustomPrompt("");

    const currentIdx = currentIndexRef.current;
    const nextIndex = (currentIdx + 1) % questions.length;
    console.log(
      `Close thank you: Navigating from question ${
        currentIdx + 1
      } to question ${nextIndex + 1}`
    );
    setCurrentIndex(nextIndex);
  };

  const handleCloseForm = () => {
    setShowUserForm(false);
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

  // Handle scroll to update current index - COMPLETELY REWRITTEN
  const handleScroll = () => {
    if (
      !scrollRef.current ||
      showUserForm ||
      showThankYou ||
      isManualScrollRef.current
    )
      return;

    const scrollLeft = scrollRef.current.scrollLeft;
    const cardWidth = scrollRef.current.clientWidth * 0.85;
    const gap = 16;
    const totalCardWidth = cardWidth + gap;

    // Use Math.round for more accurate index calculation
    const newIndex = Math.round(scrollLeft / totalCardWidth);

    if (
      newIndex !== currentIndex &&
      newIndex >= 0 &&
      newIndex < questions.length
    ) {
      console.log(
        `Scroll: Updating current index from ${currentIndex} to ${newIndex}`
      );
      setCurrentIndex(newIndex);
    }
  };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll, { passive: true });
      return () => scrollElement.removeEventListener("scroll", handleScroll);
    }
  }, [questions.length, currentIndex, showUserForm, showThankYou]);

  useEffect(() => {
    if (
      scrollRef.current &&
      !showUserForm &&
      !showThankYou &&
      !isManualScrollRef.current
    ) {
      const cardWidth = scrollRef.current.clientWidth * 0.85;
      const gap = 16;
      const totalCardWidth = cardWidth + gap;
      const targetScroll = currentIndex * totalCardWidth;

      const currentScroll = scrollRef.current.scrollLeft;
      const scrollDifference = Math.abs(currentScroll - targetScroll);

      if (scrollDifference > totalCardWidth * 0.1) {
        // 10% of card width
        console.log(
          `Scrolling to index ${currentIndex}, position ${targetScroll}`
        );
        scrollRef.current.scrollTo({
          left: targetScroll,
          behavior: "smooth",
        });
      }
    }
  }, [currentIndex, showUserForm, showThankYou]);

  const handleDotClick = (index: number) => {
    console.log(`Dot clicked: Navigating to index ${index}`);
    setCurrentIndex(index);

    if (scrollRef.current) {
      const cardWidth = scrollRef.current.clientWidth * 0.85;
      const gap = 16;
      const totalCardWidth = cardWidth + gap;
      const targetScroll = index * totalCardWidth;

      isManualScrollRef.current = true;
      scrollRef.current.scrollTo({
        left: targetScroll,
        behavior: "smooth",
      });

      setTimeout(() => {
        isManualScrollRef.current = false;
      }, 500);
    }
  };

  const isPrevDisabled = currentIndex === 0;
  const isNextDisabled = currentIndex === questions.length - 1;

  return (
    <div
      className="min-h-screen w-full bg-fill relative px-4 sm:px-6 md:px-10 py-6
             bg-[url('/mobilebg.jpg')] md:bg-[url('/webbg.jpg')]"
    >
      <div className="relative w-full max-w-6xl mx-auto z-10">
        {/* Header with Logo */}
        <div className="flex flex-col mb-8">
          <h1 className="md:text-[42px] text-[21px] md:mt-0 font-value-bold mt-12 text-[#133844] ">
            Ready to prompt the future?
          </h1>
          <p className="mt-2 text-start text-[13px] md:text-[18px] font-open-light text-[#133844]">
            This is the start of a global discussion, and here are three prompts
            to get us started.
          </p>
          <p className="text-start text-[13px] md:text-[18px] font-open-light  text-[#133844]">
            Answer any that inspire you, or share you own.
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
                  {/* Scroll Buttons - Positioned outside the container with proper states */}
                  {!showUserForm && !showThankYou && questions.length > 1 && (
                    <>
                      {/* Previous Button */}
                      <button
                        onClick={() => handleScrollClick("left")}
                        className={`absolute top-1/2 -translate-y-1/2 left-3 z-[100] md:flex items-center justify-center rounded-full w-10 h-10 transition-all hidden lg:flex prev-btn ${
                          isPrevDisabled
                            ? "bg-[#133844]/50 text-white cursor-not-allowed"
                            : "bg-[#133844]/75 text-white hover:bg-[#133844] shadow-lg cursor-pointer"
                        }`}
                        disabled={isPrevDisabled}
                      >
                        <img
                          src="/previous.svg"
                          alt="Previous"
                          className="w-[10px] h-[22px] object-contain"
                        />
                      </button>

                      {/* Next Button */}
                      <button
                        onClick={() => handleScrollClick("right")}
                        className={`absolute top-1/2 -translate-y-1/2 right-3 z-20 md:flex items-center justify-center rounded-full w-10 h-10 transition-all hidden lg:flex next-btn ${
                          isNextDisabled
                            ? "bg-[#133844]/50 text-white cursor-not-allowed"
                            : "bg-[#133844]/75 text-white hover:bg-[#133844] shadow-lg cursor-pointer"
                        }`}
                        disabled={isNextDisabled}
                      >
                        <img
                          src="/nexticon.svg"
                          alt="Next"
                          className="w-[10px] h-[22px] object-contain"
                        />
                      </button>
                    </>
                  )}

                  {/* Scrollable Cards Container - Aligned with header text */}
                  <div
                    ref={scrollRef}
                    className="flex overflow-x-auto scrollbar-hide scroll-smooth pb-4 hide-scrollbar no-y-scroll"
                    style={{ scrollBehavior: "smooth" }}
                  >
                    {showUserForm ? (
                      // USER FORM - Full width
                      <div className="flex-shrink-0 w-full bg-white/20 backdrop-blur-[30px] rounded-2xl p-4 border border-white/40 shadow-[0_4px_16px_0_rgba(19,56,68,0.1)] relative min-h-[233px]">
                        {/* Close Icon */}
                        <button
                          onClick={handleCloseForm}
                          className="absolute right-4 top-4 text-[#00BDB6] transition-colors duration-200 z-10 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-4">
                          <div className="mb-6">
                            <h2 className="text-[14px] md:text-[18px] font-open-regular text-[#000000] text-start ">
                              Please provide your details to complete the
                              submission.
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
                                className="w-full p-2 bg-transparent text-[#000000] placeholder-[#133844]/80 outline-none font-open-regular text-[11px] md:text-[15px] border-b-2 border-[#133844]/30"
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
                                className="w-full p-2 bg-transparent text-[#000000] placeholder-[#133844]/80 outline-none font-open-regular text-[11px] md:text-[15px] border-b-2 border-[#133844]/30"
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
                                className="w-full p-2 bg-transparent text-[#000000] placeholder-[#133844]/80 outline-none font-open-regular text-[11px] md:text-[15px] border-b-2 border-[#133844]/30"
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
                                className="w-full p-2 bg-transparent text-[#133844] placeholder-[#133844]/80 outline-none font-open-regular text-[11px] md:text-[15px] border-b-2 border-[#133844]/30"
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
                                className="font-open-regular text-[10px] md:text-[14px]  text-[#133844]/80 leading-relaxed text-left mt-1"
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
                    ) : showThankYou ? (
                      // THANK YOU CARD - Full width with close icon
                      <div className="flex-shrink-0 w-full bg-white/20 backdrop-blur-[30px] rounded-2xl p-4 border border-white/40 shadow-[0_4px_16px_0_rgba(19,56,68,0.1)] relative min-h-[233px]">
                        {/* Close Icon */}
                        <button
                          onClick={handleCloseThankYou}
                          className="absolute right-4 top-4 text-[#00BDB6] transition-colors duration-200 z-10 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6">
                          <h2 className="text-[12px] md:text-[14px] font-open-bold text-[#000000] text-start ">
                            THANK YOU FOR YOUR ANSWERS
                          </h2>
                          <p className="text-[15px] md:text-[18px] font-value-regular text-[#000000] text-start  mt-4">
                            Do you have a prompt of your own that you would like
                            the world to answer?
                          </p>
                        </div>
                        <hr className="border-t-1 border-[#133844]" />

                        <div className="relative">
                          <div className="p-1 relative">
                            <textarea
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              placeholder="Type your answer here"
                              className="w-full h-16 px-0 py-2 text-[#000000] placeholder-[#000000] resize-none outline-none font-open-regular text-[16px] md:text-[18px] pl-2"
                            />
                            <div className="absolute top-3 w-[1px] h-[25px] bg-[#133844]"></div>
                          </div>

                          <div className="flex justify-between items-center mt-2 px-1">
                            <div className="text-sm font-open-light text-[#133844]">
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
                      // PROMPT CARDS - With consistent 15% peek and active highlighting
                      questions.map((question, index) => (
                        <div
                          key={question.id}
                          className={`flex-shrink-0 w-[85%] md:w-[88%] 
                            bg-white/20 backdrop-blur-[30px] rounded-2xl p-4 
                            shadow-[0_4px_16px_0_rgba(19,56,68,0.1)]
                            transition-all duration-300 min-h-[233px] mr-1 md:mr-4 ml-2 md:ml-4
                            ${
                              index === currentIndex
                                ? "opacity-100 scale-100"
                                : "opacity-90 scale-[0.98]"
                            }`}
                          style={{
                            flex: "0 0 auto",
                          }}
                        >
                          <div className="">
                            <span className="text-[11px] md:text-[15px] text-[#000000] font-open-bold">
                              PROMPT {index + 1}
                            </span>
                          </div>

                          <div className="mb-2">
                            <h2 className="text-[15px] md:text-[18px] font-value-regular text-[#000000] text-start  mt-2">
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
                                  className="w-full h-16 px-0 py-2 text-[#000000] placeholder-[#000000] resize-none outline-none font-open-regular text-[16px] md:text-[18px] pl-2"
                                />
                                <div className="absolute -left-1 top-2 w-[1px] h-[25px] bg-[#133844]"></div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center mt-2 px-1">
                              <div className="text-sm font-open-light text-[#133844]">
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
                                disabled={
                                  !answers[question.id]?.trim() || isSubmitting
                                }
                                className="p-2"
                              >
                                <img
                                  src="/finish.svg"
                                  alt="Submit"
                                  className={`w-6 h-6 transition-all duration-300 ${
                                    answers[question.id]?.trim() &&
                                    !isSubmitting
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

                {/* Mobile Navigation Dots - Hidden on desktop, shown on mobile */}
                {!showUserForm && !showThankYou && questions.length > 1 && (
                  <div className="flex justify-center mt-4 lg:hidden">
                    <div className="flex space-x-2">
                      {questions.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => handleDotClick(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentIndex
                              ? "bg-[#133844]"
                              : "bg-[#133844]/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rest of the component remains the same */}
              <div className="ml-0 md:ml-4 flex-shrink-0 w-[100%] md:w-[88%] lg:flex lg:gap-6" >
                {/* LEFT COLUMN - FILTERS (30%) */}
                <div className="lg:w-[30%] mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[12px] md:text-[16px] font-bold font-open-bold text-[#133844]">
                      View by prompt
                    </h3>
                  </div>
                  {/* view bedges */}
                  <div className="grid grid-cols-3 gap-4">
                    {questions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => handleQuestionFilter(question.id)}
                        className={`prompt-badge px-2 py-2 rounded-full text-[11px] md:text-[15px] cursor-pointer font-open-regular transition-all duration-300 ${
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
                <div className="lg:w-[70%] mt-5 ml-0 md:ml-10 mb-12 md:mb-0 relative">
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
                          <p className="text-[#133844] font-open-regular text-[11px] md:text-[16px] leading-[15px] md:leading-[21px] mb-2  ">
                            {answer.answer}
                          </p>

                          <div className="font-open-bold text-[11px] md:text-[14px] text-[#133844] font-bold flex justify-between">
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
                      <div className="text-center font-open-regular text-[11px] md:text-[16px] py-6 text-white/60 h-full flex items-center justify-center">
                        <div>
                          <p>No responses yet.</p>
                          <p className="font-open-regular text-[11px] md:text-[16px] mt-2">
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
