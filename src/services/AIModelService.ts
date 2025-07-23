import { GoogleGenAI } from '@google/genai';
import { GraphAnalysisSettings } from '../types/types';
import { createKnowledgeNetworkSchema } from '../ai/schemas/knowledge-network.schema';
import { createVaultSemanticAnalysisSchema } from '../ai/schemas/vault-semantic-analysis.schema';
import { createNoteSummarySchema } from '../ai/schemas/note-summary.schema';
import { createDomainClassificationSchema, DDCSection } from '../ai/schemas/domain-classification.schema';

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

export class AIModelService {
    private settings: GraphAnalysisSettings;
    private readonly RATE_LIMIT_DELAY = 2500; // 2.5 seconds between requests for 30 RPM
    private readonly MAX_RETRIES = 3;
    private readonly MODEL_NAME = 'gemini-2.0-flash'; // Centralized model name
    private genAI: GoogleGenAI | null = null;

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
     * Structured output analysis using Gemini 2.5 Flash with response schema
     * This method ensures reliable JSON responses by using the structured output feature
     */
    public async generateStructuredAnalysis<T>(
        prompt: string,
        responseSchema: any,
        maxOutputTokens: number = 8192,
        temperature: number = 0.3, // more accurate results with lower temperature
        topP: number = 0.72
    ): Promise<AIResponse<T>> {
        if (!this.genAI) {
            throw new Error('Gemini API key not configured. Please configure your API key in settings.');
        }

        console.log(`Sending structured analysis request to ${this.MODEL_NAME} (max tokens: ${maxOutputTokens})...`);
        console.log(`STRUCTURED PROMPT (${prompt.length} chars):`);
        console.log(prompt);

        try {
            const response = await this.genAI.models.generateContent({
                model: this.MODEL_NAME,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema,
                    temperature,
                    topP,
                    maxOutputTokens
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
                console.error('Empty response details:', {
                    responseDefined: !!response,
                    textProperty: response.text,
                    candidates: response.candidates?.length || 0,
                    tokenUsage: tokenUsage
                });
                throw new Error('Empty response from Gemini API - check API key, request format, or content policy restrictions');
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
            console.error(`${this.MODEL_NAME} structured API error:`, error);
            
            const errorMessage = (error as Error).message;
            if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
                // Handle rate limiting with exponential backoff
                const waitTime = Math.max(this.RATE_LIMIT_DELAY, 5000);
                console.log(`Structured analysis rate limited (${this.MODEL_NAME}). Retrying in ${waitTime/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.generateStructuredAnalysis(prompt, responseSchema, maxOutputTokens, temperature, topP);
            }
            
            // Log additional context for debugging
            console.error('Structured analysis error context:', {
                promptLength: prompt.length,
                maxOutputTokens,
                temperature,
                topP,
                hasSchema: !!responseSchema
            });
            
            throw error;
        }
    }

    // ==========================================
    // SCHEMA FACTORY METHODS
    // ==========================================

    /**
     * Create response schema for knowledge network analysis
     */
    public createKnowledgeNetworkSchema(): any {
        return createKnowledgeNetworkSchema();
    }

    /**
     * Create response schema for vault semantic analysis batch processing
     */
    public createVaultSemanticAnalysisSchema(expectedResultCount: number): any {
        return createVaultSemanticAnalysisSchema(expectedResultCount);
    }

    /**
     * Create response schema for individual note summary analysis
     */
    public createNoteSummarySchema(): any {
        return createNoteSummarySchema();
    }

    /**
     * Create response schema for domain classification with DDC validation
     */
    public createDomainClassificationSchema(availableDDCSections: DDCSection[]): any {
        return createDomainClassificationSchema(availableDDCSections);
    }



    // ==========================================
    // DEPRECATED METHODS - SHOULD BE MIGRATED TO STRUCTURED OUTPUT
    // ==========================================
    
    /**
     * @deprecated This method uses manual JSON parsing and should be replaced with generateStructuredAnalysis
     * Used by: MasterAnalysisManager for tab-specific analysis with manual JSON parsing
     * TODO: Migrate to structured output schema
     */
    public async generateTabAnalysis(
        tabName: string,
        prompt: string,
        maxOutputTokens: number = 8000
    ): Promise<AIResponse> {
        try {
            console.log(`Sending ${tabName} tab analysis request to ${this.MODEL_NAME}...`);
            
            // Add tab-specific formatting instructions
            const enhancedPrompt = `${prompt}\n\nIMPORTANT: Your response MUST include properly formatted JSON in code blocks for the ${tabName} tab. Do not skip the JSON output.`;
            
            const response = await this.generateDirectAnalysis(
                enhancedPrompt, 
                maxOutputTokens,
                0.3,
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
     * @deprecated This method uses manual JSON parsing and should be replaced with generateStructuredAnalysis
     * Used by: VaultSemanticAnalysisManager for batch analysis of multiple files
     * TODO: Migrate to structured output schema with createVaultSemanticAnalysisSchema
     */
    public async generateBatchAnalysis<T>(
        prompt: string,
        expectedResultCount: number,
        maxOutputTokens?: number
    ): Promise<AIBatchResponse<T>> {
        const calculatedTokens = maxOutputTokens || (expectedResultCount * 150 + 300);
        
        console.log(`Sending batch analysis request for ${expectedResultCount} items to ${this.MODEL_NAME}...`);
        
        const response = await this.generateDirectAnalysis(prompt, calculatedTokens, 0.2);
        
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
     * @deprecated This method uses unstructured text output and should be replaced with generateStructuredAnalysis
     * Used by: AISummaryManager for single note analysis
     * TODO: Migrate to structured output schema with createNoteSummarySchema
     */
    public async generateAnalysis(
        prompt: string, 
        maxOutputTokens: number = 8000,
        temperature: number = 0.3
    ): Promise<AIResponse> {
        return this.generateDirectAnalysis(prompt, maxOutputTokens, temperature);
    }

    // ==========================================
    // CORE API METHODS
    // ==========================================

    /**
     * Direct API call method using SDK (for deprecated legacy methods)
     * @deprecated This method is used by deprecated methods that should migrate to generateStructuredAnalysis
     */
    private async generateDirectAnalysis(
        prompt: string, 
        maxOutputTokens: number = 12000,
        temperature: number = 0.9,
        stageLabel: string = "API Call"
    ): Promise<AIResponse> {
        if (!this.genAI) {
            throw new Error('Gemini API key not configured. Please configure your API key in settings.');
        }

        // Log complete prompt for debugging
        console.log(`${stageLabel} - COMPLETE PROMPT (${prompt.length} chars, max tokens: ${maxOutputTokens}):`);
        console.log(prompt);

        let retryCount = 0;

        while (retryCount <= this.MAX_RETRIES) {
            try {
                const response = await this.genAI.models.generateContent({
                    model: this.MODEL_NAME,
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
                console.error(`${stageLabel} - ${this.MODEL_NAME} API error:`, error);
                
                const errorMessage = (error as Error).message;
                
                // Handle rate limiting with exponential backoff
                if (errorMessage.includes('429') && retryCount < this.MAX_RETRIES) {
                    const waitTime = Math.max(this.RATE_LIMIT_DELAY, Math.pow(2, retryCount) * 3000);
                    console.log(`${stageLabel} - Rate limited (429). Retrying in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
                    
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    retryCount++;
                    continue;
                }
                
                // Handle network errors
                if (retryCount < 2 && !this.isAPIError(errorMessage)) {
                    const waitTime = (retryCount + 1) * 3000;
                    console.log(`${stageLabel} - Network error. Retrying in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/2)`);
                    
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    retryCount++;
                    continue;
                }
                
                throw error;
            }
        }

        throw new Error('Max retries exceeded');
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
     * @deprecated Remove when all methods migrate to structured output (generateStructuredAnalysis)
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
     * @deprecated Remove when all methods migrate to structured output (generateStructuredAnalysis)
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