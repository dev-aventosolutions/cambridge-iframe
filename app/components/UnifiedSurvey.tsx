"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
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
    publicConsent: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingCustomPrompt, setSubmittingCustomPrompt] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approvedAnswers, setApprovedAnswers] = useState<any[]>([]);
  const [filteredAnswers, setFilteredAnswers] = useState<any[]>([]);
  const [featuredAnswers, setFeaturedAnswers] = useState<any[]>([]);
  const [refreshingAnswers, setRefreshingAnswers] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [currentAnswerPage, setCurrentAnswerPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isNavigatingRef = useRef(false);
  const [preventScrollUpdate, setPreventScrollUpdate] = useState(false);
  const [isNavigatingAfterThankYou, setIsNavigatingAfterThankYou] =
    useState(false);

  // Carousel states
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [showAllAnswersModal, setShowAllAnswersModal] = useState(false);
  const [showFullAnswerModal, setShowFullAnswerModal] = useState(false);
  const [selectedFullAnswer, setSelectedFullAnswer] = useState<any>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const isCarouselAutoScrolling = useRef(false);
  const carouselScrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Modal scrollbar refs
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalThumbRef = useRef<HTMLDivElement>(null);
  const fullAnswerModalContainerRef = useRef<HTMLDivElement>(null);
  const fullAnswerModalThumbRef = useRef<HTMLDivElement>(null);
  const isModalDraggingRef = useRef(false);
  const modalDragStartYRef = useRef(0);
  const modalDragStartScrollTopRef = useRef(0);
  const isFullAnswerModalDraggingRef = useRef(false);
  const fullAnswerModalDragStartYRef = useRef(0);
  const fullAnswerModalDragStartScrollTopRef = useRef(0);

  // Form validation states
  const [formErrors, setFormErrors] = useState({
    name: "",
    email: "",
    gdprConsent: "",
    publicConsent: "",
  });

  const [submittedRecordIds, setSubmittedRecordIds] = useState<string[]>([]);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  const CHARACTER_LIMIT = 1000;
  const ANSWERS_PER_PAGE = 4;
  const ANSWER_PREVIEW_LIMIT = 300;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(0);
  const isManualScrollRef = useRef(false);

  // Full Answer Modal scrollbar effect
  useEffect(() => {
    if (!showFullAnswerModal) return;

    const container = fullAnswerModalContainerRef.current;
    const thumb = fullAnswerModalThumbRef.current;
    if (!container || !thumb) return;

    const MIN_THUMB_HEIGHT = 50;

    const updateThumb = () => {
      const clientH = container.clientHeight;
      const scrollH = container.scrollHeight;
      const scrollTop = container.scrollTop;

      // Check if content is scrollable
      const isScrollable = scrollH > clientH;

      // Resolve track element (cast to HTMLElement so .style exists)
      const track = container.parentElement
        ? (container.parentElement.querySelector(
            ".scrollbar-track"
          ) as HTMLElement | null)
        : null;

      // Update thumb visibility
      if (isScrollable) {
        let thumbH = Math.max(MIN_THUMB_HEIGHT, (clientH / scrollH) * clientH);
        thumbH = Math.min(clientH, thumbH);
        thumb.style.height = `${thumbH}px`;

        const maxScroll = Math.max(0, scrollH - clientH);
        const maxThumbTop = Math.max(0, clientH - thumbH);
        const thumbTop =
          maxScroll === 0 ? 0 : (scrollTop / maxScroll) * maxThumbTop;
        thumb.style.transform = `translateY(${thumbTop}px)`;
        thumb.style.display = "block"; // Show thumb
        if (track) {
          track.style.display = "block"; // Show track
        }
      } else {
        thumb.style.display = "none"; // Hide thumb
        if (track) {
          track.style.display = "none"; // Hide track
        }
      }
    };

    const handleThumbMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isFullAnswerModalDraggingRef.current = true;
      fullAnswerModalDragStartYRef.current = e.clientY;
      fullAnswerModalDragStartScrollTopRef.current = container.scrollTop;

      document.addEventListener("mousemove", handleThumbMouseMove);
      document.addEventListener("mouseup", handleThumbMouseUp);

      document.body.style.cursor = "grabbing";
      thumb.style.cursor = "grabbing";
    };

    const handleThumbTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isFullAnswerModalDraggingRef.current = true;
      fullAnswerModalDragStartYRef.current = e.touches[0].clientY;
      fullAnswerModalDragStartScrollTopRef.current = container.scrollTop;

      document.addEventListener("touchmove", handleThumbTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleThumbTouchEnd);
    };

    const handleThumbMouseMove = (e: MouseEvent) => {
      if (!isFullAnswerModalDraggingRef.current) return;

      const deltaY = e.clientY - fullAnswerModalDragStartYRef.current;
      const scrollRatio = container.scrollHeight / container.clientHeight;
      const newScrollTop =
        fullAnswerModalDragStartScrollTopRef.current + deltaY * scrollRatio;

      container.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, container.scrollHeight - container.clientHeight)
      );
    };

    const handleThumbTouchMove = (e: TouchEvent) => {
      if (!isFullAnswerModalDraggingRef.current) return;

      e.preventDefault();

      const deltaY =
        e.touches[0].clientY - fullAnswerModalDragStartYRef.current;
      const scrollRatio = container.scrollHeight / container.clientHeight;
      const newScrollTop =
        fullAnswerModalDragStartScrollTopRef.current + deltaY * scrollRatio;

      container.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, container.scrollHeight - container.clientHeight)
      );
    };

    const handleThumbMouseUp = () => {
      isFullAnswerModalDraggingRef.current = false;

      document.removeEventListener("mousemove", handleThumbMouseMove);
      document.removeEventListener("mouseup", handleThumbMouseUp);

      document.body.style.cursor = "";
      thumb.style.cursor = "grab";
    };

    const handleThumbTouchEnd = () => {
      isFullAnswerModalDraggingRef.current = false;

      document.removeEventListener("touchmove", handleThumbTouchMove);
      document.removeEventListener("touchend", handleThumbTouchEnd);
    };

    // Initialize thumb
    updateThumb();

    // Add event listeners
    thumb.addEventListener("mousedown", handleThumbMouseDown);
    thumb.addEventListener("touchstart", handleThumbTouchStart, {
      passive: false,
    });

    container.addEventListener("scroll", updateThumb, { passive: true });
    window.addEventListener("resize", updateThumb);

    const ro = new MutationObserver(updateThumb);
    ro.observe(container, { childList: true, subtree: true });

    return () => {
      thumb.removeEventListener("mousedown", handleThumbMouseDown);
      thumb.removeEventListener("touchstart", handleThumbTouchStart);

      document.removeEventListener("mousemove", handleThumbMouseMove);
      document.removeEventListener("mouseup", handleThumbMouseUp);
      document.removeEventListener("touchmove", handleThumbTouchMove);
      document.removeEventListener("touchend", handleThumbTouchEnd);

      container.removeEventListener("scroll", updateThumb);
      window.removeEventListener("resize", updateThumb);
      ro.disconnect();
    };
  }, [showFullAnswerModal]);

  // Modal scrollbar effect
  useEffect(() => {
    if (!showAllAnswersModal) return;

    const container = modalContainerRef.current;
    const thumb = modalThumbRef.current;
    if (!container || !thumb) return;

    const MIN_THUMB_HEIGHT = 50;

    const updateThumb = () => {
      const clientH = container.clientHeight;
      const scrollH = container.scrollHeight;
      const scrollTop = container.scrollTop;

      let thumbH = Math.max(MIN_THUMB_HEIGHT, (clientH / scrollH) * clientH);
      thumbH = Math.min(clientH, thumbH);
      thumb.style.height = `${thumbH}px`;

      const maxScroll = Math.max(0, scrollH - clientH);
      const maxThumbTop = Math.max(0, clientH - thumbH);
      const thumbTop =
        maxScroll === 0 ? 0 : (scrollTop / maxScroll) * maxThumbTop;
      thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    const handleThumbMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isModalDraggingRef.current = true;
      modalDragStartYRef.current = e.clientY;
      modalDragStartScrollTopRef.current = container.scrollTop;

      document.addEventListener("mousemove", handleThumbMouseMove);
      document.addEventListener("mouseup", handleThumbMouseUp);

      document.body.style.cursor = "grabbing";
      thumb.style.cursor = "grabbing";
    };

    const handleThumbTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isModalDraggingRef.current = true;
      modalDragStartYRef.current = e.touches[0].clientY;
      modalDragStartScrollTopRef.current = container.scrollTop;

      document.addEventListener("touchmove", handleThumbTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleThumbTouchEnd);
    };

    const handleThumbMouseMove = (e: MouseEvent) => {
      if (!isModalDraggingRef.current) return;

      const deltaY = e.clientY - modalDragStartYRef.current;
      const scrollRatio = container.scrollHeight / container.clientHeight;
      const newScrollTop =
        modalDragStartScrollTopRef.current + deltaY * scrollRatio;

      container.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, container.scrollHeight - container.clientHeight)
      );
    };

    const handleThumbTouchMove = (e: TouchEvent) => {
      if (!isModalDraggingRef.current) return;

      e.preventDefault();

      const deltaY = e.touches[0].clientY - modalDragStartYRef.current;
      const scrollRatio = container.scrollHeight / container.clientHeight;
      const newScrollTop =
        modalDragStartScrollTopRef.current + deltaY * scrollRatio;

      container.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, container.scrollHeight - container.clientHeight)
      );
    };

    const handleThumbMouseUp = () => {
      isModalDraggingRef.current = false;

      document.removeEventListener("mousemove", handleThumbMouseMove);
      document.removeEventListener("mouseup", handleThumbMouseUp);

      document.body.style.cursor = "";
      thumb.style.cursor = "grab";
    };

    const handleThumbTouchEnd = () => {
      isModalDraggingRef.current = false;

      document.removeEventListener("touchmove", handleThumbTouchMove);
      document.removeEventListener("touchend", handleThumbTouchEnd);
    };

    // Initialize thumb
    updateThumb();

    // Add event listeners
    thumb.addEventListener("mousedown", handleThumbMouseDown);
    thumb.addEventListener("touchstart", handleThumbTouchStart, {
      passive: false,
    });

    container.addEventListener("scroll", updateThumb, { passive: true });
    window.addEventListener("resize", updateThumb);

    const ro = new MutationObserver(updateThumb);
    ro.observe(container, { childList: true, subtree: true });

    return () => {
      thumb.removeEventListener("mousedown", handleThumbMouseDown);
      thumb.removeEventListener("touchstart", handleThumbTouchStart);

      document.removeEventListener("mousemove", handleThumbMouseMove);
      document.removeEventListener("mouseup", handleThumbMouseUp);
      document.removeEventListener("touchmove", handleThumbTouchMove);
      document.removeEventListener("touchend", handleThumbTouchEnd);

      container.removeEventListener("scroll", updateThumb);
      window.addEventListener("resize", updateThumb);
      ro.disconnect();
    };
  }, [filteredAnswers, showAllAnswersModal]);

  // Original custom scrollbar effect (keep this as is)
  useEffect(() => {
    const c = containerRef.current;
    const thumb = thumbRef.current;
    if (!c || !thumb) return;

    const MIN_THUMB_HEIGHT = 50;

    const updateThumb = () => {
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

    const handleThumbMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      dragStartYRef.current = e.clientY;
      dragStartScrollTopRef.current = c.scrollTop;

      document.addEventListener("mousemove", handleThumbMouseMove);
      document.addEventListener("mouseup", handleThumbMouseUp);

      document.body.style.cursor = "grabbing";
      thumb.style.cursor = "grabbing";
    };

    const handleThumbTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      dragStartYRef.current = e.touches[0].clientY;
      dragStartScrollTopRef.current = c.scrollTop;

      document.addEventListener("touchmove", handleThumbTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleThumbTouchEnd);
    };

    const handleThumbMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaY = e.clientY - dragStartYRef.current;
      const scrollRatio = c.scrollHeight / c.clientHeight;
      const newScrollTop = dragStartScrollTopRef.current + deltaY * scrollRatio;

      c.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, c.scrollHeight - c.clientHeight)
      );
    };

    const handleThumbTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;

      e.preventDefault();

      const deltaY = e.touches[0].clientY - dragStartYRef.current;
      const scrollRatio = c.scrollHeight / c.clientHeight;
      const newScrollTop = dragStartScrollTopRef.current + deltaY * scrollRatio;

      c.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, c.scrollHeight - c.clientHeight)
      );
    };

    const handleThumbMouseUp = () => {
      isDraggingRef.current = false;

      document.removeEventListener("mousemove", handleThumbMouseMove);
      document.removeEventListener("mouseup", handleThumbMouseUp);

      document.body.style.cursor = "";
      thumb.style.cursor = "grab";
    };

    const handleThumbTouchEnd = () => {
      isDraggingRef.current = false;

      document.removeEventListener("touchmove", handleThumbTouchMove);
      document.removeEventListener("touchend", handleThumbTouchEnd);
    };

    updateThumb();

    thumb.addEventListener("mousedown", handleThumbMouseDown);
    thumb.addEventListener("touchstart", handleThumbTouchStart, {
      passive: false,
    });

    c.addEventListener("scroll", updateThumb, { passive: true });
    window.addEventListener("resize", updateThumb);

    const ro = new MutationObserver(updateThumb);
    ro.observe(c, { childList: true, subtree: true });

    return () => {
      thumb.removeEventListener("mousedown", handleThumbMouseDown);
      thumb.removeEventListener("touchstart", handleThumbTouchStart);

      document.removeEventListener("mousemove", handleThumbMouseMove);
      document.removeEventListener("mouseup", handleThumbMouseUp);
      document.removeEventListener("touchmove", handleThumbTouchMove);
      document.removeEventListener("touchend", handleThumbTouchEnd);

      c.removeEventListener("scroll", updateThumb);
      window.removeEventListener("resize", updateThumb);
      ro.disconnect();
    };
  }, [filteredAnswers]);

  // Rest of your existing useEffect hooks and functions remain the same...
  useEffect(() => {
    loadQuestions();
    loadApprovedAnswers();
  }, []);

  useEffect(() => {
    if (questions.length > 0 && !selectedQuestion) {
      setSelectedQuestion(questions[0].id);
    }
  }, [questions]);

  useEffect(() => {
    if (selectedQuestion) {
      const filtered = approvedAnswers.filter(
        (answer) => answer.questionId === selectedQuestion
      );
      setFilteredAnswers(filtered);
      
      // Filter featured answers for carousel
      const featured = filtered.filter(answer => answer.featured === "Yes");
      setFeaturedAnswers(featured);
    } else {
      setFilteredAnswers(approvedAnswers);
      
      // Filter featured answers for carousel from all approved answers
      const featured = approvedAnswers.filter(answer => answer.featured === "Yes");
      setFeaturedAnswers(featured);
    }
    setCurrentAnswerPage(0);
    setCurrentCarouselIndex(0);
  }, [selectedQuestion, approvedAnswers]);

  // Fixed carousel auto-scroll - using featuredAnswers now
  useEffect(() => {
    if (featuredAnswers.length <= 1) return;

    const timer = setInterval(() => {
      if (!isCarouselAutoScrolling.current) {
        setCurrentCarouselIndex((prev) =>
          prev === featuredAnswers.length - 1 ? 0 : prev + 1
        );
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [featuredAnswers.length]);

  // Fixed carousel scroll effect - using featuredAnswers now
  useLayoutEffect(() => {
    if (carouselRef.current && featuredAnswers.length > 0) {
      const container = carouselRef.current;
      const target = container.children[currentCarouselIndex] as HTMLElement;
      
      if (target) {
        isCarouselAutoScrolling.current = true;
        
        container.scrollTo({
          left: target.offsetLeft,
          behavior: "smooth",
        });

        // Clear any existing timeout
        if (carouselScrollTimeout.current) {
          clearTimeout(carouselScrollTimeout.current);
        }

        // Reset the flag after scroll completes
        carouselScrollTimeout.current = setTimeout(() => {
          isCarouselAutoScrolling.current = false;
        }, 500);
      }
    }
  }, [currentCarouselIndex, featuredAnswers.length]);

  // Fixed carousel scroll handler - using featuredAnswers now
  useEffect(() => {
    const container = carouselRef.current;
    if (!container || featuredAnswers.length === 0) return;

    const handleScroll = () => {
      // Only update if not auto-scrolling and not manually scrolling via timeout
      if (isCarouselAutoScrolling.current) return;

      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      
      // Calculate current index based on scroll position
      const newIndex = Math.round(scrollLeft / containerWidth);
      
      if (newIndex >= 0 && newIndex < featuredAnswers.length && newIndex !== currentCarouselIndex) {
        setCurrentCarouselIndex(newIndex);
      }
    };

    // Use requestAnimationFrame for smoother scroll handling
    let rafId: number;
    const throttledScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };

    container.addEventListener("scroll", throttledScroll, { passive: true });
    
    return () => {
      container.removeEventListener("scroll", throttledScroll);
      cancelAnimationFrame(rafId);
      if (carouselScrollTimeout.current) {
        clearTimeout(carouselScrollTimeout.current);
      }
    };
  }, [featuredAnswers.length, currentCarouselIndex]);

  // Fixed carousel dot click handler - using featuredAnswers now
  const handleCarouselDotClick = (index: number) => {
    console.log("Carousel dot clicked:", index);
    
    // Set manual scrolling flag
    isCarouselAutoScrolling.current = true;
    
    // Update the index
    setCurrentCarouselIndex(index);
    
    // Clear any existing timeout
    if (carouselScrollTimeout.current) {
      clearTimeout(carouselScrollTimeout.current);
    }
    
    // Reset the flag after a delay
    carouselScrollTimeout.current = setTimeout(() => {
      isCarouselAutoScrolling.current = false;
    }, 1000);
  };

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

      // Sort: Featured first, then by date (newest first)
      const sorted = approvedAnswersData.sort((a, b) => {
        // Featured answers first
        if (a.featured === "Yes" && b.featured !== "Yes") return -1;
        if (a.featured !== "Yes" && b.featured === "Yes") return 1;
        
        // Then by submission date (newest first)
        return (
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      });

      const mergedAnswers = sorted.map((a) => {
        const q = questionsData.find((q) => q.id === a.questionId);
        return {
          ...a,
          order: q?.order ?? 999,
          questionNumber:
            questionsData.findIndex((q) => q.id === a.questionId) + 1,
          questionText: q?.question || "Unknown Question",
        };
      });

      setApprovedAnswers(mergedAnswers);

      if (questionsData.length > 0) {
        const prompt1Id = questionsData[0].id;
        const prompt1Answers = mergedAnswers.filter(
          (answer) => answer.questionId === prompt1Id
        );
        setFilteredAnswers(prompt1Answers);
        
        // Set featured answers for carousel
        const featuredPrompt1Answers = prompt1Answers.filter(answer => answer.featured === "Yes");
        setFeaturedAnswers(featuredPrompt1Answers);
      } else {
        setFilteredAnswers(mergedAnswers);
        
        // Set featured answers for carousel
        const featuredAllAnswers = mergedAnswers.filter(answer => answer.featured === "Yes");
        setFeaturedAnswers(featuredAllAnswers);
      }
    } catch (error) {
      console.error("Error loading answers:", error);
    } finally {
      setRefreshingAnswers(false);
    }
  };

  // Get answers for modal - featured first, then recent
  const getModalAnswers = () => {
    if (!selectedQuestion) {
      return approvedAnswers;
    }
    
    const filtered = approvedAnswers.filter(
      (answer) => answer.questionId === selectedQuestion
    );
    
    // Separate featured and non-featured answers
    const featured = filtered.filter(answer => answer.featured === "Yes");
    const nonFeatured = filtered.filter(answer => answer.featured !== "Yes");
    
    // Return featured first, then non-featured (already sorted by date)
    return [...featured, ...nonFeatured];
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    if (value.length <= CHARACTER_LIMIT) {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }
  };

  const validateUserInfo = (): boolean => {
    const errors = {
      name: "",
      email: "",
      gdprConsent: "",
      publicConsent: "",
    };

    let isValid = true;

    if (!userInfo.name.trim()) {
      errors.name = "This field is required";
      isValid = false;
    }

    if (!userInfo.gdprConsent) {
      errors.gdprConsent = "Please agree to our Privacy Policy to proceed.";
      isValid = false;
    }

    if (!userInfo.publicConsent) {
      errors.publicConsent =
        "Please confirm your understanding that your name, country, and organisation may be displayed publicly.";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const clearFieldError = (fieldName: keyof typeof formErrors) => {
    setFormErrors((prev) => ({
      ...prev,
      [fieldName]: "",
    }));
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
    } else {
      console.error("Failed to submit. Try again.");
    }
  };

  const handleDirectSubmit = async () => {
    if (isSubmitting) return;

    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !answers[currentQuestion.id]?.trim()) {
      return;
    }

    if (
      !hasSubmittedBefore ||
      !userInfo.gdprConsent ||
      !userInfo.publicConsent
    ) {
      setShowUserForm(true);
      return;
    }

    if (!validateUserInfo()) {
      setShowUserForm(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitting(true);
    setPreventScrollUpdate(true);

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

      setAnswers((prev) => {
        const newAnswers = { ...prev };
        delete newAnswers[currentQuestion.id];
        return newAnswers;
      });

      loadApprovedAnswers();

      console.log(`Submitted answer for Prompt ${currentIndex + 1}`);
    } else {
      console.error("Failed to submit. Try again.");
    }

    setTimeout(() => {
      setPreventScrollUpdate(false);
    }, 1000);
  };

  const handleCustomPromptSubmit = async () => {
    if (!customPrompt.trim() || isNavigatingRef.current) {
      return;
    }

    isNavigatingRef.current = true;
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
        const currentIndexValue = currentIndexRef.current;
        const nextIndex = (currentIndexValue + 1) % questions.length;

        console.log(
          `🚀 NAVIGATION START: ${currentIndexValue} -> ${nextIndex}`
        );

        setSelectedQuestion(null);
        setShowThankYou(false);
        setCustomPrompt("");
        setSubmittedRecordIds([]);

        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);

        setTimeout(() => {
          if (scrollRef.current) {
            const target = scrollRef.current.children[nextIndex] as HTMLElement;
            if (target) {
              scrollRef.current.scrollTo({
                left: target.offsetLeft,
                behavior: "smooth",
              });
            }
          }
          isNavigatingRef.current = false;
          console.log(`✅ NAVIGATION COMPLETE: Now at index ${nextIndex}`);
        }, 50);
      } else {
        isNavigatingRef.current = false;
        console.error("Failed to submit custom prompt. Try again.");
      }
    } catch (error) {
      console.error("Error submitting custom prompt:", error);
      isNavigatingRef.current = false;
    } finally {
      setSubmittingCustomPrompt(false);
    }
  };

  const handleCloseThankYou = () => {
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    const currentIndexValue = currentIndexRef.current;
    const nextIndex = (currentIndexValue + 1) % questions.length;

    console.log(`🚀 NAVIGATION START: ${currentIndexValue} -> ${nextIndex}`);

    setSelectedQuestion(null);
    setShowThankYou(false);
    setCustomPrompt("");

    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);

    setTimeout(() => {
      if (scrollRef.current) {
        const target = scrollRef.current.children[nextIndex] as HTMLElement;
        if (target) {
          scrollRef.current.scrollTo({
            left: target.offsetLeft,
            behavior: "smooth",
          });
        }
      }
      isNavigatingRef.current = false;
      console.log(`✅ NAVIGATION COMPLETE: Now at index ${nextIndex}`);
    }, 50);
  };

  const handleQuestionFilter = (questionId: string | null) => {
    setSelectedQuestion(questionId);

    if (questionId) {
      const questionIndex = questions.findIndex((q) => q.id === questionId);
      if (questionIndex !== -1) {
        console.log(`Filter: Navigating to prompt ${questionIndex + 1}`);
        setCurrentIndex(questionIndex);
        currentIndexRef.current = questionIndex;
      }
    }
  };

  const handleCloseForm = () => {
    setShowUserForm(false);
    setFormErrors({ name: "", email: "", gdprConsent: "", publicConsent: "" });
  };

  const handleShowFullAnswer = (answer: any) => {
    setSelectedFullAnswer(answer);
    setShowFullAnswerModal(true);
  };

  const handleCloseFullAnswerModal = () => {
    setShowFullAnswerModal(false);
    setSelectedFullAnswer(null);
  };

  const handleScroll = () => {
    if (
      !scrollRef.current ||
      showUserForm ||
      showThankYou ||
      isManualScrollRef.current ||
      preventScrollUpdate
    )
      return;

    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    let closestIndex = 0;
    let minDiff = Infinity;
    Array.from(container.children).forEach((child, index) => {
      const diff = Math.abs((child as HTMLElement).offsetLeft - scrollLeft);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });
    if (
      closestIndex !== currentIndex &&
      closestIndex >= 0 &&
      closestIndex < questions.length
    ) {
      console.log(
        `Scroll: Updating current index from ${currentIndex} to ${closestIndex}`
      );
      setCurrentIndex(closestIndex);
    }
  };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll, { passive: true });
      return () => scrollElement.removeEventListener("scroll", handleScroll);
    }
  }, [questions.length, currentIndex, showUserForm, showThankYou]);

  useLayoutEffect(() => {
    console.log(
      `Scroll effect triggered: currentIndex=${currentIndex}, showUserForm=${showUserForm}, showThankYou=${showThankYou}, preventScrollUpdate=${preventScrollUpdate}`
    );

    if (
      scrollRef.current &&
      !showUserForm &&
      !showThankYou &&
      !isManualScrollRef.current &&
      !preventScrollUpdate
    ) {
      const target = scrollRef.current.children[currentIndex] as HTMLElement;
      if (target) {
        const targetScroll = target.offsetLeft;
        const currentScroll = scrollRef.current.scrollLeft;
        const scrollDifference = Math.abs(currentScroll - targetScroll);
        const approximateCardWidth = scrollRef.current.clientWidth * 0.85;

        if (scrollDifference > approximateCardWidth * 0.1) {
          console.log(
            `Scrolling to index ${currentIndex}, position ${targetScroll}`
          );

          isManualScrollRef.current = true;
          scrollRef.current.scrollTo({
            left: targetScroll,
            behavior: "smooth",
          });

          setTimeout(() => {
            isManualScrollRef.current = false;
          }, 500);
        }
      }
    }
  }, [currentIndex, showUserForm, showThankYou, preventScrollUpdate]);

  const handleDotClick = (index: number) => {
    console.log(`Dot clicked: Navigating to index ${index}`);
    setCurrentIndex(index);
  };

  const handleScrollClick = (direction: "left" | "right") => {
    const newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    setCurrentIndex(newIndex);
  };

  const isPrevDisabled = currentIndex === 0;
  const isNextDisabled = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen w-full bg-fill relative px-4 sm:px-6 md:px-10 py-6 bg-[url('/mobilebg.jpg')] md:bg-[url('/webbg.jpg')]">
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
            Answer any that inspire you, or share your own.
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
            <div>
              {/* PROMPT CARDS SLIDER OR USER FORM OR THANK YOU */}
              <div className="mb-6 relative">
                {/* Scroll Buttons - Positioned outside the container with proper states */}
                {!showUserForm && !showThankYou && questions.length > 1 && (
                  <>
                    {/* Previous Button - Hide on first card */}
                    {!isPrevDisabled && (
                      <button
                        onClick={() => handleScrollClick("left")}
                        className="absolute top-1/2 -translate-y-1/2 left-3 z-[30] md:flex items-center justify-center rounded-full w-10 h-10 transition-all hidden lg:flex prev-btn bg-[#133844]/75 text-white hover:bg-[#133844] shadow-lg cursor-pointer"
                      >
                        <img
                          src="/previous.svg"
                          alt="Previous"
                          className="w-[10px] h-[22px] object-contain"
                        />
                      </button>
                    )}

                    {/* Next Button - Hide on last card */}
                    {!isNextDisabled && (
                      <button
                        onClick={() => handleScrollClick("right")}
                        className="absolute top-1/2 -translate-y-1/2 right-3 z-20 md:flex items-center justify-center rounded-full w-10 h-10 transition-all hidden lg:flex next-btn bg-[#133844]/75 text-white hover:bg-[#133844] shadow-lg cursor-pointer"
                      >
                        <img
                          src="/nexticon.svg"
                          alt="Next"
                          className="w-[10px] h-[22px] object-contain"
                        />
                      </button>
                    )}
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
                        <div className="mb-6 pr-14 md:pr-0">
                          {" "}
                          {/* More padding on mobile, none on medium+ screens */}
                          <h2 className="text-[14px] md:text-[18px] font-open-regular text-[#133844] text-start">
                            Please provide your details to complete the
                            submission.
                          </h2>
                        </div>
                        <hr className="border-t-1 border-[#133844]" />

                        <div className="space-y-6">
                          {/* Form fields with validation */}
                          <div>
                            <input
                              type="text"
                              value={userInfo.name}
                              onChange={(e) => {
                                setUserInfo({
                                  ...userInfo,
                                  name: e.target.value,
                                });
                                clearFieldError("name");
                              }}
                              className={`w-full p-2 bg-transparent text-[#000000] placeholder-[#133844]/80 outline-none font-open-regular text-[11px] md:text-[15px] border-b-2 ${
                                formErrors.name
                                  ? "border-red-500"
                                  : "border-[#133844]/30"
                              }`}
                              placeholder="Name *"
                            />
                            {formErrors.name && (
                              <p className="text-red-500 text-[10px] mt-1 font-open-regular">
                                {formErrors.name}
                              </p>
                            )}
                          </div>

                          <div>
                            <input
                              type="email"
                              value={userInfo.email}
                              onChange={(e) => {
                                setUserInfo({
                                  ...userInfo,
                                  email: e.target.value,
                                });
                                clearFieldError("email");
                              }}
                              className={`w-full p-2 bg-transparent text-[#000000] placeholder-[#133844]/80 outline-none font-open-regular text-[11px] md:text-[15px] border-b-2 ${
                                formErrors.email
                                  ? "border-red-500"
                                  : "border-[#133844]/30"
                              }`}
                              placeholder="Email"
                            />
                            <p className="font-open-regular text-[10px] md:text-[12px] text-[#133844]/80 leading-relaxed text-left mt-1">
                              Please add your email to receive updates on the
                              ongoing conversation.{" "}
                            </p>
                            {formErrors.email && (
                              <p className="text-red-500 text-[10px] mt-1 font-open-regular">
                                {formErrors.email}
                              </p>
                            )}
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
                              placeholder="Country"
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
                              placeholder="Organisation"
                            />
                          </div>

                          {/* GDPR Consent Checkbox */}
                          <div className="flex items-start gap-3 pt-2">
                            <div className="flex-shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                id="gdpr"
                                checked={userInfo.gdprConsent}
                                onChange={(e) => {
                                  setUserInfo({
                                    ...userInfo,
                                    gdprConsent: e.target.checked,
                                  });
                                  clearFieldError("gdprConsent");
                                }}
                                className={`custom-checkbox ${
                                  formErrors.gdprConsent ? "border-red-500" : ""
                                }`}
                              />
                            </div>
                            <label
                              htmlFor="gdpr"
                              className="font-open-regular text-[10px] md:text-[14px] text-[#133844]/80 leading-relaxed text-left flex-1"
                            >
                              By clicking Submit, you confirm that you are over
                              18 years old and agree to our{" "}
                              <a
                                href="https://www.cambridge.org/legal/privacy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0056b3] hover:text-[#003d80] underline"
                              >
                                Privacy Policy
                              </a>
                              .*
                            </label>
                          </div>
                          {formErrors.gdprConsent && (
                            <p className="text-red-500 text-[10px] font-open-regular -mt-5">
                              {formErrors.gdprConsent}
                            </p>
                          )}

                          {/* Public Consent Checkbox */}
                          <div className="flex items-start gap-3 pt-2">
                            <div className="flex-shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                id="publicConsent"
                                checked={userInfo.publicConsent}
                                onChange={(e) => {
                                  setUserInfo({
                                    ...userInfo,
                                    publicConsent: e.target.checked,
                                  });
                                  clearFieldError("publicConsent");
                                }}
                                className={`custom-checkbox ${
                                  formErrors.publicConsent
                                    ? "border-red-500"
                                    : ""
                                }`}
                              />
                            </div>
                            <label
                              htmlFor="publicConsent"
                              className="font-open-regular text-[10px] md:text-[14px] text-[#133844]/80 leading-relaxed text-left flex-1"
                            >
                              By clicking Submit, you confirm that you
                              understand that your name, country, and
                              organisation may be displayed publicly.*
                            </label>
                          </div>
                          {formErrors.publicConsent && (
                            <p className="text-red-500 text-[10px] font-open-regular -mt-5">
                              {formErrors.publicConsent}
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end pt-6">
                          <button
                            type="button"
                            onClick={() => {
                              if (!submitting && !isSubmitting) handleSubmit();
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
                          Thank you for submitting your insights. Our team will
                          review your response shortly.
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
                          <h2 className="text-[15px] md:text-[18px] font-value-regular text-[#000000] md:h-[50px] text-start  mt-2">
                            {question.question}
                          </h2>
                          <p className="text-[10px] md:text-[12px] font-open-thin text-[#133844] text-start mt-3">
                            {" "}
                            Please do not include personal information such as
                            names, age, etc.
                          </p>
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
                                  userInfo.gdprConsent &&
                                  userInfo.publicConsent
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

              {/* Featured Answers Carousel Section */}
              <div className="mb-12 mt-12 md:flex">
                <div className="md:min-w-80">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[14px] md:text-[20px] font-open-bold text-[#133844]">
                      Featured answers:
                    </h3>
                  </div>

                  {/* Filter Badges */}
                  <div className="flex gap-3 mb-6 flex-wrap">
                    {questions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => handleQuestionFilter(question.id)}
                        className={`px-4 py-2 rounded-full text-[12px] md:text-[14px] font-open-regular cursor-pointer transition-all duration-300 ${
                          selectedQuestion === question.id
                            ? "bg-[#133844] text-white shadow-lg"
                            : "bg-[#00BDB6] text-white hover:bg-[#00a89e]"
                        }`}
                      >
                        Prompt {index + 1}
                      </button>
                    ))}
                  </div>

                  {/* See All Answers Link */}
                  <button
                    onClick={() => setShowAllAnswersModal(true)}
                    className="text-[#133844] text-[13px] md:text-[16px] font-open-regular underline mb-6 hover:text-[#00BDB6] transition-colors cursor-pointer"
                  >
                    See all answers
                  </button>
                </div>

                <div className="md:max-w-[73%]">
                  {/* Carousel Container */}
                  {featuredAnswers?.length > 0 ? (
                    <div className="relative">
                      {/* Carousel */}
                      <div
                        ref={carouselRef}
                        className="carousel-container overflow-x-auto scrollbar-hide scroll-smooth flex md:gap-6 gap-4"
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        {featuredAnswers?.map((answer, index) => (
                          <div
                            key={answer.id}
                            className="carousel-item flex-shrink-0 w-full md:w-[83%] lg:w-[80%] md:p-6 py-2 relative"
                            style={{
                              animationDelay: `${index * 0.1}s`,
                            }}
                          >
                            {/* Featured Badge */}
                            <div className="mb-3">
                              <span className="inline-block bg-[#FFD700] text-[#133844] text-[10px] md:text-[12px] font-open-bold px-3 py-1 rounded-full">
                                Featured
                              </span>
                            </div>

                            {/* Answer Text */}
                            <div className="mb-2">
                              <p className="text-[#133844] font-open-regular text-[13px] md:text-[16px] leading-relaxed pr-4 break-words">
                                {answer?.answer.length > ANSWER_PREVIEW_LIMIT
                                  ? `${answer?.answer?.substring(
                                      0,
                                      ANSWER_PREVIEW_LIMIT
                                    )}...`
                                  : answer?.answer}
                              </p>
                              {answer?.answer.length > ANSWER_PREVIEW_LIMIT && (
                                <button
                                  onClick={() => handleShowFullAnswer(answer)}
                                  className="text-[#00BDB6] text-[12px] md:text-[14px] font-open-regular underline mt-2 hover:text-[#00a89e] transition-colors cursor-pointer"
                                >
                                  See more
                                </button>
                              )}
                            </div>

                            {/* User Name */}
                            <div className="font-open-bold text-[12px] md:text-[14px] text-[#133844] mt-2">
                              {answer?.userName
                                ? answer?.userName
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
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Navigation Dots */}
                      <div className="flex justify-start md:ml-8  gap-2 md:mt-4">
                        {featuredAnswers?.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => handleCarouselDotClick(index)}
                            className={`carousel-dot w-2 h-2 rounded-full transition-all duration-300 ${
                              index === currentCarouselIndex
                                ? "bg-[#133844]"
                                : "bg-transparent border border-[#133844] hover:bg-[#133844]/50"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Gradient Overlay on Right - Updated */}
                      <div className="hidden md:block absolute top-0 right-0 w-[112px] h-full pointer-events-none carousel-gradient-overlay"></div>
                    </div>
                  ) : (
                    <div className="text-center font-open-regular text-[13px] md:text-[16px] py-12 text-[#133844]/60">
                      <p>No featured responses yet.</p>
                      <p className="mt-2">
                        Be the first to share your thoughts!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* All Answers Modal */}
              {showAllAnswersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                  {/* Backdrop */}
                  <div
                    className="absolute bg-[#133844]/20 backdrop-blur-sm"
                    onClick={() => setShowAllAnswersModal(false)}
                  />

                  {/* Modal */}
                  <div className="relative w-full z-50 max-w-6xl max-h-[70vh] bg-white/50 backdrop-blur-[20px] rounded-2xl border border-white/90 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="sticky top-0 p-6 pb-0 flex items-center justify-between z-50">
                      <h2 className="text-[16px] md:text-[24px] font-open-bold text-[#133844]">
                        All answers:
                      </h2>
                      <button
                        onClick={() => setShowAllAnswersModal(false)}
                        className="text-[#00BDB6] hover:text-[#00a89e] transition-colors cursor-pointer"
                      >
                        <span className="text-[18px] font-open-bold">
                          <span className="text-black border-b mr-1 text-sm">
                            Close
                          </span>{" "}
                          <X className="w-8 h-8 inline-block" />
                        </span>
                      </button>
                    </div>

                    {/* Filter Badges */}
                    <div className="sticky top-[70px] p-6 pt-0 flex gap-3 flex-wrap z-10">
                      {questions.map((question, index) => (
                        <button
                          key={question.id}
                          onClick={() => handleQuestionFilter(question.id)}
                          className={`px-4 py-2 rounded-full text-[12px] md:text-[14px] font-open-regular cursor-pointer transition-all duration-300 ${
                            selectedQuestion === question.id
                              ? "bg-[#133844] text-white shadow-lg"
                              : "bg-[#00BDB6] text-white hover:bg-[#00a89e]"
                          }`}
                        >
                          Prompt {index + 1}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable Content with Custom Scrollbar */}
                    <div className="relative overflow-hidden">
                      <div
                        ref={modalContainerRef}
                        className="overflow-y-auto hide-native-scrollbar max-h-[calc(70vh-200px)] p-6 pt-0 z-50"
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        {/* Custom scrollbar track */}
                        <div className="absolute top-0 right-5 md:h-[420px] h-[435px] rounded w-[5px] bg-[#B9EFE3] -z-3" />

                        {getModalAnswers()?.length > 0 ? (
                          <div className="space-y-6 z-50">
                            {getModalAnswers()?.map((answer) => (
                              <div
                                key={answer.id}
                                className="py-2 pl-2 border-b mr-8 last:border-b-0 border-[#133844]/30"
                              >
                                {/* Featured Badge */}
                                {answer.featured === "Yes" && (
                                  <div className="mb-3">
                                    <span className="inline-block bg-[#00BDB6] text-white text-[10px] md:text-[12px] font-open-bold px-3 py-1 rounded-full">
                                      Featured
                                    </span>
                                  </div>
                                )}

                                {/* Answer Text */}
                                <div className="mb-4">
                                  <p className="text-[#133844] font-open-regular text-[13px] md:text-[16px] leading-relaxed break-words">
                                    {answer.answer}
                                  </p>
                                </div>

                                {/* User Name */}
                                <div className="font-open-bold text-[12px] md:text-[14px] text-[#133844]">
                                  {answer.userName
                                    ? answer.userName
                                        .split(" ")
                                        .map(
                                          (word: any, index: any, array: any) =>
                                            index === 0
                                              ? word
                                              : index === 1 && array.length > 1
                                              ? word.charAt(0) + "."
                                              : ""
                                        )
                                        .join(" ")
                                        .trim()
                                    : "Anonymous"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center font-open-regular text-[14px] md:text-[16px] py-12 text-[#133844]/60">
                            <p>No responses yet.</p>
                            <p className="mt-2">
                              Be the first to share your thoughts!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Custom Thumb */}
                      <div ref={modalThumbRef} className="custom-thumb" />
                    </div>
                  </div>
                </div>
              )}

              {/* Full Answer Modal */}
              {showFullAnswerModal && selectedFullAnswer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                  {/* Backdrop */}
                  <div
                    className="absolute bg-[#133844]/20 backdrop-blur-sm"
                    onClick={handleCloseFullAnswerModal}
                  />

                  {/* Modal */}
                  <div className="relative w-full z-50 max-w-6xl max-h-[70vh] bg-white/50 backdrop-blur-[20px] rounded-2xl border border-white/90 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="sticky top-0 py-4 px-2 pb-0 flex items-center justify-between z-50">
                      <h2 className="text-[16px] md:text-[24px] font-open-bold text-[#133844]">
                        {/* Full Answer */}
                      </h2>
                      <button
                        onClick={handleCloseFullAnswerModal}
                        className="text-[#00BDB6] hover:text-[#00a89e] transition-colors cursor-pointer"
                      >
                        <X className="w-8 h-8" />
                      </button>
                    </div>

                    {/* Scrollable Content with Custom Scrollbar */}
                    <div className="relative overflow-hidden">
                      <div
                        ref={fullAnswerModalContainerRef}
                        className="overflow-y-auto hide-native-scrollbar max-h-[calc(80vh-100px)] p-6 z-50"
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        {/* Custom scrollbar track */}
                        <div className="scrollbar-track absolute top-0 right-5 h-full rounded w-[5px] bg-[#B9EFE3] -z-3" />

                        {/* Featured Badge */}
                        {selectedFullAnswer.featured === "Yes" && (
                          <div className="mb-4">
                            <span className="inline-block bg-[#00BDB6] text-white text-[10px] md:text-[12px] font-open-bold px-3 py-1 rounded-full">
                              Featured
                            </span>
                          </div>
                        )}

                        {/* Answer Text */}
                        <div className="mb-6">
                          <p className="text-[#133844] font-open-regular text-[14px] md:text-[16px] leading-relaxed whitespace-pre-wrap break-words">
                            {selectedFullAnswer.answer}
                          </p>
                        </div>

                        {/* User Name */}
                        <div className="font-open-bold text-[12px] md:text-[14px] text-[#133844] border-t border-[#133844]/20 pt-4">
                          {selectedFullAnswer.userName
                            ? selectedFullAnswer.userName
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
                        </div>
                      </div>

                      {/* Custom Thumb */}
                      <div
                        ref={fullAnswerModalThumbRef}
                        className="custom-thumb"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}