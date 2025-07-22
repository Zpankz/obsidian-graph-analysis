import { GoogleGenAI } from '@google/genai';
import { GraphAnalysisSettings } from '../types/types';

export interface TokenUsage {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
}

export interface AIResponse<T = string> {
    result: T;
    tokenUsage: TokenUsage;
}

export interface AIBatchResponse<T = any> {
    results: T[];
    tokenUsage: TokenUsage;
}

// NEW: Add Type import for structured output
import { Type } from '@google/genai';

export class AIModelService {
    private settings: GraphAnalysisSettings;
    private readonly RATE_LIMIT_DELAY = 2500; // 2.5 seconds between requests for 30 RPM
    private readonly MAX_RETRIES = 3;
    private genAI: GoogleGenAI | null = null;
    
    // NEW: Track if context is loaded to avoid redundant loading
    private contextLoaded: boolean = false;

    constructor(settings: GraphAnalysisSettings) {
        this.settings = settings;
        this.initializeGenAI();
    }

    /**
     * Initialize the Google GenAI client
     */
    private initializeGenAI(): void {
        if (this.settings?.geminiApiKey && this.settings.geminiApiKey.trim() !== '') {
            this.genAI = new GoogleGenAI({ apiKey: this.settings.geminiApiKey });
        }
    }

    /**
     * Update settings (useful when settings change)
     */
    public updateSettings(settings: GraphAnalysisSettings): void {
        this.settings = settings;
        this.initializeGenAI();
    }
    
    /**
     * NEW: Check if context is loaded
     */
    public isContextLoaded(): boolean {
        return this.contextLoaded;
    }
    
    /**
     * NEW: Set context loaded state
     */
    public setContextLoaded(loaded: boolean): void {
        this.contextLoaded = loaded;
    }

    /**
     * Single analysis request to Gemini 2.0 Flash-Lite
     */
    public async generateAnalysis(
        prompt: string, 
        maxOutputTokens: number = 8000,
        temperature: number = 0.3
    ): Promise<AIResponse> {
        return this.callGeminiFlashLite(prompt, maxOutputTokens, temperature);
    }

    /**
     * Data chunk storage request (for chunked analysis)
     */
    public async storeDataChunk(
        prompt: string,
        chunkIndex: number,
        totalChunks: number
    ): Promise<string> {
        try {
            // Use more output tokens to ensure model has room to acknowledge
            const response = await this.callGeminiFlashLite(
                prompt, 
                200, // Increased from 50 to allow for proper acknowledgment
                0.1,  // Low temperature for consistent responses
                0,    // Retry count
                `STAGE 1 (Chunk ${chunkIndex}/${totalChunks})` // Label for logs
            );
            
            // Verify the model acknowledged receipt properly
            const result = response.result.toLowerCase();
            const expectedAcknowledgment = chunkIndex === totalChunks 
                ? "received complete" 
                : `received chunk ${chunkIndex}`;
                
            if (!result.includes(expectedAcknowledgment.toLowerCase())) {
                console.error(`❌ ERROR - Model didn't properly acknowledge chunk ${chunkIndex}/${totalChunks}. Response: "${response.result}"`);
                throw new Error(`Failed to get proper acknowledgment for chunk ${chunkIndex}/${totalChunks}`);
            } else {
                console.log(`✅ Chunk ${chunkIndex}/${totalChunks} processed and acknowledged successfully`);
            }
            
            // Mark context as loaded if this is the last chunk
            if (chunkIndex === totalChunks) {
                this.contextLoaded = true;
                console.log('✅ All data chunks loaded successfully, context is ready');
            }
            
            return response.result;
        } catch (error) {
            console.error(`❌ ERROR - Failed to store data chunk ${chunkIndex}/${totalChunks}:`, error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    /**
     * Complete analysis request (optimal for single requests)
     */
    public async generateCompleteAnalysis(
        prompt: string,
        maxOutputTokens: number = 8000
    ): Promise<AIResponse> {
        try {
            console.log(`Sending complete analysis request to Gemini 2.0 Flash-Lite (max tokens: ${maxOutputTokens})...`);
            
            // Add explicit instructions to ensure proper JSON formatting
            const enhancedPrompt = `${prompt}\n\nIMPORTANT: Your response MUST include properly formatted JSON in code blocks. Do not skip the JSON output.`;
            
            const response = await this.callGeminiFlashLite(
                enhancedPrompt, 
                maxOutputTokens,
                0.3,
                0,
                "STAGE 2 (Analysis)" // Label for logs
            );
            
            // Check if response contains JSON code blocks
            if (!response.result.includes('```json') && !response.result.includes('```')) {
                console.error('❌ ERROR - Response does not contain JSON code blocks.');
                console.log('❌ ERROR - Response preview:', response.result.substring(0, 500));
                throw new Error('AI response does not contain required JSON code blocks');
            }
            
            return response;
        } catch (error) {
            console.error('❌ ERROR - Failed to generate complete analysis:', error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }
    
    /**
     * NEW: Tab-specific analysis request
     */
    public async generateTabAnalysis(
        tabName: string,
        prompt: string,
        maxOutputTokens: number = 8000
    ): Promise<AIResponse> {
        try {
            if (!this.contextLoaded) {
                throw new Error('Context not loaded. Please load data context first.');
            }
            
            console.log(`Sending ${tabName} tab analysis request to Gemini 2.0 Flash-Lite...`);
            
            // Add tab-specific formatting instructions
            const enhancedPrompt = `${prompt}\n\nIMPORTANT: Your response MUST include properly formatted JSON in code blocks for the ${tabName} tab. Do not skip the JSON output.`;
            
            const response = await this.callGeminiFlashLite(
                enhancedPrompt, 
                maxOutputTokens,
                0.3,
                0,
                `${tabName.toUpperCase()} TAB ANALYSIS` // Label for logs
            );
            
            // Check if response contains JSON code blocks
            if (!response.result.includes('```json') && !response.result.includes('```')) {
                console.error(`❌ ERROR - ${tabName} tab response does not contain JSON code blocks.`);
                console.log('❌ ERROR - Response preview:', response.result.substring(0, 500));
                throw new Error(`AI response for ${tabName} tab does not contain required JSON code blocks`);
            }
            
            return response;
        } catch (error) {
            console.error(`❌ ERROR - Failed to generate ${tabName} tab analysis:`, error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    /**
     * NEW: Structured output analysis using Gemini 2.5 Flash with response schema
     * This method ensures reliable JSON responses by using the structured output feature
     */
    public async generateStructuredAnalysis<T>(
        prompt: string,
        responseSchema: any,
        maxOutputTokens: number = 8000,
        temperature: number = 0.3,
        topP: number = 0.72
    ): Promise<AIResponse<T>> {
        if (!this.genAI) {
            throw new Error('Gemini API key not configured. Please configure your API key in settings.');
        }

        console.log(`Sending structured analysis request to Gemini 2.5 Flash (max tokens: ${maxOutputTokens})...`);
        console.log(`STRUCTURED PROMPT (${prompt.length} chars):`);
        console.log(prompt);

        try {
            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema,
                    thinkingConfig: {
                        thinkingBudget: 0, // Disables thinking for faster responses
                    },
                    temperature,
                    topP,
                    // maxOutputTokens
                }
            });

            // Extract token usage from the response
            const tokenUsage: TokenUsage = {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            };

            const result = response.text?.trim() || '';
            
            if (!result) {
                throw new Error('Empty response from Gemini API');
            }
            
            // Parse the JSON response since it's guaranteed to be valid JSON
            let parsedResult: T;
            try {
                parsedResult = JSON.parse(result) as T;
            } catch (parseError) {
                console.error('Failed to parse structured response as JSON:', parseError);
                throw new Error(`Failed to parse structured response: ${(parseError as Error).message}`);
            }

            console.log(`STRUCTURED RESPONSE SUCCESS (${result.length} chars, tokens: ${tokenUsage.totalTokens})`);
            console.log('Parsed result:', parsedResult);

            return {
                result: parsedResult,
                tokenUsage
            };

        } catch (error) {
            console.error('Gemini 2.5 Flash structured API error:', error);
            
            const errorMessage = (error as Error).message;
            if (errorMessage.includes('429')) {
                // Handle rate limiting
                const waitTime = Math.max(this.RATE_LIMIT_DELAY, 5000);
                console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.generateStructuredAnalysis(prompt, responseSchema, maxOutputTokens, temperature, topP);
            }
            
            throw error;
        }
    }

    /**
     * NEW: Create response schema for knowledge network analysis
     * This matches the schema used in the test code
     */
    public createKnowledgeNetworkSchema(): any {
        return {
            type: Type.OBJECT,
            properties: {
                knowledgeNetwork: {
                    type: Type.OBJECT,
                    properties: {
                        bridges: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    domain: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    topNotes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                title: { type: Type.STRING },
                                                path: { type: Type.STRING },
                                                rank: { type: Type.NUMBER }
                                            },
                                            propertyOrdering: ["title", "path", "rank"]
                                        }
                                    },
                                    connections: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    },
                                    insights: { type: Type.STRING }
                                },
                                propertyOrdering: ["domain", "explanation", "topNotes", "connections", "insights"]
                            }
                        },
                        foundations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    domain: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    topNotes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                title: { type: Type.STRING },
                                                path: { type: Type.STRING },
                                                rank: { type: Type.NUMBER }
                                            },
                                            propertyOrdering: ["title", "path", "rank"]
                                        }
                                    },
                                    coverage: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    },
                                    insights: { type: Type.STRING }
                                },
                                propertyOrdering: ["domain", "explanation", "topNotes", "coverage", "insights"]
                            }
                        },
                        authorities: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    domain: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    topNotes: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                title: { type: Type.STRING },
                                                path: { type: Type.STRING },
                                                rank: { type: Type.NUMBER }
                                            },
                                            propertyOrdering: ["title", "path", "rank"]
                                        }
                                    },
                                    influence: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    },
                                    insights: { type: Type.STRING }
                                },
                                propertyOrdering: ["domain", "explanation", "topNotes", "influence", "insights"]
                            }
                        }
                    },
                    propertyOrdering: ["bridges", "foundations", "authorities"]
                },
                knowledgeGaps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            propertyOrdering: ["knowledgeNetwork", "knowledgeGaps"]
        };
    }

    /**
     * Batch analysis request for multiple items
     */
    public async generateBatchAnalysis<T>(
        prompt: string,
        expectedResultCount: number,
        maxOutputTokens?: number
    ): Promise<AIBatchResponse<T>> {
        const calculatedTokens = maxOutputTokens || (expectedResultCount * 150 + 300);
        
        console.log(`Sending batch analysis request for ${expectedResultCount} items to Gemini 2.0 Flash-Lite...`);
        
        const response = await this.callGeminiFlashLite(prompt, calculatedTokens, 0.2);
        
        // Try to parse as JSON array
        try {
            const results = this.parseJSONResponse<T[]>(response.result, expectedResultCount);
            console.log(`Successfully parsed ${results.length} analysis results`);
            
            return {
                results,
                tokenUsage: response.tokenUsage
            };
        } catch (parseError) {
            console.error('Failed to parse batch response as JSON:', parseError);
            throw new Error(`Failed to parse batch analysis response: ${(parseError as Error).message}`);
        }
    }




    


    /**
     * Core API call method for Gemini 2.5 Flash using SDK
     */
    private async callGeminiFlashLite(
        prompt: string, 
        maxOutputTokens: number = 12000,
        temperature: number = 0.9,
        retryCount: number = 0,
        stageLabel: string = "API Call" // Default label
    ): Promise<AIResponse> {
        if (!this.genAI) {
            throw new Error('Gemini API key not configured. Please configure your API key in settings.');
        }

        // Log complete prompt for debugging
        console.log(`${stageLabel} - COMPLETE PROMPT (${prompt.length} chars, max tokens: ${maxOutputTokens}):`);
        console.log(prompt);

        try {
            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature,
                    maxOutputTokens,
                }
            });

            // Extract token usage from the response
            const tokenUsage: TokenUsage = {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            };

            const result = response.text?.trim() || '';
            
            if (!result) {
                throw new Error('Empty response from Gemini API');
            }
            
            // Log complete response for debugging
            console.log(`${stageLabel} - COMPLETE RESPONSE (${result.length} chars, tokens: ${tokenUsage.totalTokens}):`);
            console.log(result);

            return {
                result,
                tokenUsage
            };

        } catch (error) {
            console.error(`${stageLabel} - Gemini 2.5 Flash API error:`, error);
            
            const errorMessage = (error as Error).message;
            if (errorMessage.includes('429') && retryCount < this.MAX_RETRIES) {
                return this.handleRateLimit(prompt, maxOutputTokens, temperature, retryCount, stageLabel);
            }
            
            // Network error retry
            if (retryCount < 2 && !this.isAPIError(errorMessage)) {
                return this.handleNetworkRetry(prompt, maxOutputTokens, temperature, retryCount, stageLabel);
            }
            
            throw error;
        }
    }

    /**
     * Handle rate limiting with exponential backoff
     */
    private async handleRateLimit(
        prompt: string,
        maxOutputTokens: number,
        temperature: number,
        retryCount: number,
        stageLabel: string = "API Call"
    ): Promise<AIResponse> {
        const waitTime = Math.max(this.RATE_LIMIT_DELAY, Math.pow(2, retryCount) * 3000);
        console.log(`${stageLabel} - Rate limited (429). Retrying in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return await this.callGeminiFlashLite(prompt, maxOutputTokens, temperature, retryCount + 1, stageLabel);
    }

    /**
     * Handle network retry
     */
    private async handleNetworkRetry(
        prompt: string,
        maxOutputTokens: number,
        temperature: number,
        retryCount: number,
        stageLabel: string = "API Call"
    ): Promise<AIResponse> {
        const waitTime = (retryCount + 1) * 3000;
        console.log(`${stageLabel} - Network error. Retrying in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/2)`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return await this.callGeminiFlashLite(prompt, maxOutputTokens, temperature, retryCount + 1, stageLabel);
    }

    /**
     * Check if error is an API-specific error (not network error)
     */
    private isAPIError(errorMessage: string): boolean {
        return errorMessage.includes('Rate limit') || 
               errorMessage.includes('429') || 
               errorMessage.includes('API') ||
               errorMessage.includes('Invalid response format');
    }

    /**
     * Parse JSON response with fallback handling
     */
    private parseJSONResponse<T>(responseText: string, expectedLength?: number): T {
        // Clean the response text by removing markdown code blocks
        let cleanedResponse = responseText.trim();
        
        // Remove markdown code block markers if present
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const parsed = JSON.parse(cleanedResponse);
        
        // Validate array length if expected
        if (expectedLength !== undefined && Array.isArray(parsed)) {
            if (parsed.length !== expectedLength) {
                console.warn(`Response array length mismatch. Expected: ${expectedLength}, Got: ${parsed.length}`);
                // Pad or truncate as needed
                const adjustedResults = [];
                for (let i = 0; i < expectedLength; i++) {
                    if (i < parsed.length && parsed[i]) {
                        adjustedResults.push(parsed[i]);
                    } else {
                        adjustedResults.push(this.createFallbackResult());
                    }
                }
                return adjustedResults as unknown as T;
            }
        }
        
        return parsed;
    }

    /**
     * Create fallback result for failed parsing
     */
    private createFallbackResult(): any {
        return {
            summary: 'Analysis incomplete',
            keywords: '',
            knowledgeDomain: ''
        };
    }

    /**
     * Rate limiting helper - wait between requests
     */
    public async waitForRateLimit(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
    }

    /**
     * Calculate recommended delay based on request count
     */
    public calculateDelay(requestCount: number): number {
        // For 30 RPM limit, ensure we don't exceed the rate
        return Math.max(this.RATE_LIMIT_DELAY, (60 * 1000) / 25); // 25 requests per minute to be safe
    }
} 