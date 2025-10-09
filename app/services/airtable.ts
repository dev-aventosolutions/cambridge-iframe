import axios from "axios";

const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY as string;
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID as string;

const airtableApi = axios.create({
  baseURL: `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`,
  headers: {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
});

export interface Question {
  id: string;
  question: string;
  type: string;
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
  submittedAt: string; // ✅ Main timestamp to sort by
}

export interface UserInfo {
  name: string;
  email: string;
  country: string;
  gdprConsent: boolean;
}

export const airtableService = {
  async getQuestions(): Promise<Question[]> {
    try {
      const response = await airtableApi.get("/Questions", {
        params: {
          sort: [{ field: "order", direction: "asc" }],
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return response.data.records.map((record: any) => ({
        id: record.id,
        question: record.fields.question,
        type: record.fields.type,
        order: record.fields.order,
      }));
    } catch (error) {
      console.error("Error fetching questions:", error);
      return [];
    }
  },

  async submitAnswers(
    answers: { questionId: string; question: string; answer: string }[],
    userInfo: UserInfo
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
          gdrp_consent: userInfo.gdprConsent ? "Yes" : "No",
          submittedAt: new Date().toISOString(), // ✅ Use this only
        },
      }));

      await airtableApi.post("/Answers", { records });
      return true;
    } catch (error) {
      console.error("Error submitting answers:", error);
      return false;
    }
  },

  async getAnswers(): Promise<Answer[]> {
    try {
      const response = await airtableApi.get("/Answers", {
        params: {
          sort: [{ field: "submittedAt", direction: "desc" }], // ✅ Sort by submittedAt
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return response.data.records.map((record: any) => ({
        id: record.id,
        questionId: record.fields.questionId,
        question: record.fields.question,
        answer: record.fields.answer,
        userName: record.fields.userName,
        userEmail: record.fields.userEmail,
        userCountry: record.fields.userCountry,
        submittedAt: record.fields.submittedAt,
      }));
    } catch (error) {
      console.error("Error fetching answers:", error);
      return [];
    }
  },
};
