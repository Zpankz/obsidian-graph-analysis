import { Type } from '@google/genai';

/**
 * Interface for individual note summary analysis result
 */
export interface NoteSummaryAnalysis {
    keyWords: string;
    keyPoints: string;
    knowledgeDomain: string;
}

/**
 * Schema for individual note summary analysis using Google Gemini structured output
 * This schema is used by AISummaryManager.callGeminiAPI()
 * 
 * Current format expected by AISummaryManager:
 * **Key Words:** [List 3-6 most relevant keywords or key phrases, separated by commas]
 * **Key Points:** [One concise sentence that captures the main idea and key points of the note]
 * **Knowledge Domain:** [List 2-4 relevant fields or domains this content belongs to, separated by commas]
 */
export function createNoteSummarySchema(): any {
    return {
        type: Type.OBJECT,
        properties: {
            keyWords: { 
                type: Type.STRING,
                description: "List 3-6 most relevant keywords or key phrases, separated by commas"
            },
            keyPoints: { 
                type: Type.STRING,
                description: "One concise sentence that captures the main idea and key points of the note"
            },
            knowledgeDomain: { 
                type: Type.STRING,
                description: "List 2-4 relevant fields or domains this content belongs to, separated by commas"
            }
        },
        required: ["keyWords", "keyPoints", "knowledgeDomain"],
        propertyOrdering: ["keyWords", "keyPoints", "knowledgeDomain"]
    };
} 