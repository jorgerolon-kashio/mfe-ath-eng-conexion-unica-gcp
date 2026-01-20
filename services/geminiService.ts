
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Correctly initialize GoogleGenAI with a named parameter.
    // The API key is assumed to be available in process.env.API_KEY.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async processJsonWithPrompt(prompt: string, jsonData: any): Promise<string> {
    try {
      // Use ai.models.generateContent directly with model name and prompt.
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `
          System Instruction: You are a senior data analyst and frontend architect.
          The user is providing a JSON dataset and a custom prompt.
          Your goal is to follow the instructions in the prompt using the data provided.
          If the prompt asks for analysis, be deep and structured.
          If the prompt asks for code or UI suggestions, use Tailwind CSS and React patterns.

          DATASET:
          ${JSON.stringify(jsonData, null, 2)}

          USER PROMPT:
          ${prompt}
        `,
        config: {
          temperature: 0.7,
          // Thinking config is supported for Gemini 3 series.
          thinkingConfig: { thinkingBudget: 4000 }
        }
      });

      // Use the .text property to access the generated content string.
      return response.text || "No response generated.";
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return `Error: ${error.message || "Unknown error during processing."}`;
    }
  }
}

export const geminiService = new GeminiService();
