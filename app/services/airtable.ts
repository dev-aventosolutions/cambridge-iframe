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
  userOrganization?: string;
  submittedAt: string;
  status?: string;
  suggested_prompt?: string;
}

export interface UserInfo {
  name: string;
  email: string;
  country: string;
  organization?: string;
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
  ): Promise<{ success: boolean; recordIds?: string[] }> {
    try {
      const validAnswers = answers.filter(
        (answer) => answer.answer && answer.answer.trim() !== ""
      );

      if (validAnswers.length === 0) {
        console.error("No valid answers to submit");
        return { success: false };
      }

      const records = validAnswers.map((answer) => ({
        fields: {
          questionId: answer.questionId,
          question: answer.question,
          answer: answer.answer.trim(),
          userName: userInfo.name,
          userEmail: userInfo.email,
          userCountry: userInfo.country,
          userOrganization: userInfo.organization,
          privacy_policy: userInfo.gdprConsent ? "Yes" : "No",
          submittedAt: new Date().toISOString(),
          status: "Pending",
          suggested_prompt: "",
        },
      }));

      console.log("Submitting answers:", records);
      const response = await airtableApi.post("/Answers", { records });
      console.log("Submission successful:", response.data);
      
      const recordIds = response.data.records.map((record: any) => record.id);
      return { success: true, recordIds };
    } catch (error) {
      console.error("Error submitting answers:", error);
      return { success: false };
    }
  },

  async submitSingleAnswer(
    answer: { questionId: string; question: string; answer: string },
    userInfo: UserInfo
  ): Promise<{ success: boolean; recordId?: string }> {
    try {
      if (!answer.answer || answer.answer.trim() === "") {
        console.error("Empty answer cannot be submitted");
        return { success: false };
      }

      const record = {
        fields: {
          questionId: answer.questionId,
          question: answer.question,
          answer: answer.answer.trim(),
          userName: userInfo.name,
          userEmail: userInfo.email,
          userCountry: userInfo.country,
          userOrganization: userInfo.organization,
          privacy_policy: userInfo.gdprConsent ? "Yes" : "No",
          submittedAt: new Date().toISOString(),
          status: "Pending",
          suggested_prompt: "",
        },
      };

      console.log("Submitting single answer:", record);
      const response = await airtableApi.post("/Answers", { records: [record] });
      console.log("Single answer submission successful:", response.data);
      
      const recordId = response.data.records[0].id;
      return { success: true, recordId };
    } catch (error) {
      console.error("Error submitting single answer:", error);
      return { success: false };
    }
  },

  async updateAnswerWithCustomPrompt(
    recordId: string,
    customPrompt: string
  ): Promise<boolean> {
    try {
      if (!customPrompt.trim()) {
        console.error("Empty custom prompt cannot be submitted");
        return false;
      }

      const updateData = {
        fields: {
          suggested_prompt: customPrompt.trim(),
        },
      };

      console.log("Updating answer with custom prompt:", { recordId, customPrompt });
      await airtableApi.patch(`/Answers/${recordId}`, updateData);
      console.log("Custom prompt update successful");
      return true;
    } catch (error) {
      console.error("Error updating answer with custom prompt:", error);
      return false;
    }
  },

  // Add back the submitCustomPrompt method as a fallback
  async submitCustomPrompt(
    customPrompt: string,
    userInfo: UserInfo
  ): Promise<boolean> {
    try {
      if (!customPrompt.trim()) {
        console.error("Empty custom prompt cannot be submitted");
        return false;
      }

      const record = {
        fields: {
          suggested_prompt: customPrompt.trim(),
          userName: userInfo.name,
          userEmail: userInfo.email,
          userCountry: userInfo.country,
          userOrganization: userInfo.organization,
          privacy_policy: userInfo.gdprConsent ? "Yes" : "No",
          submittedAt: new Date().toISOString(),
          status: "Pending",
        },
      };

      console.log("Submitting custom prompt as new record:", record);
      const response = await airtableApi.post("/Answers", { records: [record] });
      console.log("Custom prompt submission successful:", response.data);
      return true;
    } catch (error) {
      console.error("Error submitting custom prompt:", error);
      return false;
    }
  },

  async getAnswers(): Promise<Answer[]> {
    try {
      const response = await airtableApi.get("/Answers", {
        params: {
          sort: [{ field: "submittedAt", direction: "desc" }],
        },
      });

      return response.data.records.map((record: any) => ({
        id: record.id,
        questionId: record.fields.questionId,
        question: record.fields.question,
        answer: record.fields.answer,
        userName: record.fields.userName,
        userEmail: record.fields.userEmail,
        userCountry: record.fields.userCountry,
        userOrganization: record.fields.userOrganization,
        submittedAt: record.fields.submittedAt,
        status: record.fields.status || "Pending",
        suggested_prompt: record.fields.suggested_prompt,
      }));
    } catch (error) {
      console.error("Error fetching answers:", error);
      return [];
    }
  },
};