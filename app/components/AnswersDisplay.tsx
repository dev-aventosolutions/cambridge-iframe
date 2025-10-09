/* eslint-disable react-refresh/only-export-components */
"use client";

import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/grid";
import "swiper/css/pagination";
import { Grid, Pagination, Autoplay } from "swiper/modules";

// ==================== ✅ Airtable Config ====================

const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY as string;
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID as string;

const airtableApi = axios.create({
  baseURL: `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`,
  headers: {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
});

// ==================== ✅ Interfaces ====================

export interface Question {
  id: string;
  question: string;
  order: number;
}

export interface Answer {
  id: string;
  questionId: string;
  question: string;
  answer: string;
  userName?: string;
  userEmail?: string;
  userCountry?: string;
  submittedAt: string;
  status: "Pending" | "Approved" | "Rejected";
  order?: number;
}

// ==================== ✅ Airtable Service ====================

export const airtableService = {
  async getQuestions(): Promise<Question[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await airtableApi.get<{ records: any[] }>("/Questions", {
        params: { sort: [{ field: "order", direction: "asc" }] },
      });
      return res.data.records.map((r) => ({
        id: r.id,
        question: r.fields.question,
        order: r.fields.order,
      }));
    } catch (err) {
      console.error("Error fetching questions:", err);
      return [];
    }
  },

  async getAnswers(): Promise<Answer[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await airtableApi.get<{ records: any[] }>("/Answers", {
        params: { sort: [{ field: "submittedAt", direction: "desc" }] },
      });

      const records = response.data.records
        .map((record) => {
          const f = record.fields;
          if (!f.question || !f.answer?.trim()) return null;
          const status =
            f.status === "Approved" || f.status === "Pending" || f.status === "Rejected"
              ? f.status
              : "Pending";
          return {
            id: record.id,
            questionId: f.questionId || "",
            question: f.question,
            answer: f.answer,
            userName: f.userName || "",
            userEmail: f.userEmail || "",
            userCountry: f.userCountry || "",
            submittedAt: f.submittedAt || new Date().toISOString(),
            status,
          } as Answer;
        })
        .filter((a): a is Answer => a !== null);

      return records.filter((a) => a.status === "Approved");
    } catch (error) {
      console.error("Error fetching answers:", error);
      return [];
    }
  },

  async submitAnswers(
    answers: { questionId: string; question: string; answer: string }[],
    userInfo: { name: string; email: string; country: string; gdprConsent: boolean }
  ): Promise<boolean> {
    try {
      const records = answers.map((answer) => ({
        fields: {
          questionId: answer.questionId,
          question: answer.question,
          answer: answer.answer,
          userName: userInfo.name,
          userEmail: userInfo.email,
          userCountry: userInfo.country,
          gdpr_consent: userInfo.gdprConsent ? "Yes" : "No",
          submittedAt: new Date().toISOString(),
          status: "Pending",
        },
      }));

      await airtableApi.post("/Answers", { records });
      return true;
    } catch (error) {
      console.error("Error submitting answers:", error);
      return false;
    }
  },
};

// ==================== ✅ Display Component ====================

export default function AnswersDisplay() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    loadAnswers();
  }, []);

  const loadAnswers = async () => {
    try {
      setLoading(true);
      const [questionsData, answersData] = await Promise.all([
        airtableService.getQuestions(),
        airtableService.getAnswers(),
      ]);

      const mergedAnswers = answersData.map((a) => {
        const q = questionsData.find((q) => q.id === a.questionId);
        return { ...a, order: q?.order ?? 999 };
      });

      const sorted = mergedAnswers.sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

      setAnswers(sorted);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnswers();
    setRefreshing(false);
  };

  const truncateText = (text: string, length: number) =>
    text.length > length ? text.slice(0, length) + "..." : text;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat p-10 bg-white relative">
      <div className="max-w-7xl mx-auto backdrop-blur-sm rounded-3xl p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-4xl font-extrabold text-slate-800">
            Approved Survey Responses
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-6 py-3 text-slate-700 rounded-xl hover:shadow-lg transition-all duration-200 font-semibold border-2 border-slate-200 hover:border-blue-300"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Swiper */}
        <Swiper
          modules={[Grid, Pagination, Autoplay]}
          spaceBetween={25}
          slidesPerView={3}
          grid={{ rows: 2, fill: "row" }}
          pagination={{ clickable: true }}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          className="!pb-12"
          breakpoints={{
            320: { slidesPerView: 1, grid: { rows: 1 } },
            640: { slidesPerView: 2, grid: { rows: 2 } },
            1024: { slidesPerView: 3, grid: { rows: 2 } },
          }}
        >
          {answers.map((answer, index) => {
            const isLong = answer.answer.length > 100;
            const displayedText = truncateText(answer.answer, 100);

            return (
              <SwiperSlide key={answer.id}>
                <div
                  className="relative w-[85%] mx-auto rounded-[32px] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
                  style={{
                    height: "250px",
                    backgroundImage:
                      "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url('/bg.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="p-6 h-full flex flex-col justify-center items-center text-center text-white">
                    <h3 className="text-xl font-semibold mb-4 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                      Question {answer.order ?? index + 1}
                    </h3>

                    <p className="text-slate-100 mb-2 leading-relaxed text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {answer.question}
                    </p>

                    <p className="text-slate-300 text-xs italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {displayedText}
                      {isLong && (
                        <button
                          onClick={() => setSelectedAnswer(answer)}
                          className="ml-2 text-blue-400 underline text-xs hover:text-blue-300"
                        >
                          Read More
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>

      {/* ==================== ✅ BEAUTIFIED MODAL ==================== */}
      {selectedAnswer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-50">
          <div
            className="relative w-[85%] md:w-[65%] lg:w-[50%] max-h-[70vh] overflow-y-auto rounded-3xl shadow-2xl p-10 border border-white/20"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url('/bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <button
              onClick={() => setSelectedAnswer(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
            >
              <X size={28} />
            </button>

            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]">
                {selectedAnswer.question}
              </h2>

              <p className="text-white/90 leading-relaxed text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-pre-line">
                {selectedAnswer.answer}
              </p>

              <div className="text-right mt-8">
                <button
                  onClick={() => setSelectedAnswer(null)}
                  className="bg-blue-600/90 hover:bg-blue-700 text-white px-6 py-2 rounded-full shadow-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
