import { GoogleGenAI } from '@google/genai';
import { GraphAnalysisSettings } from '../types/types';
import { createKnowledgeNetworkSchema } from '../ai/schemas/knowledge-network.schema';
import { createVaultSemanticAnalysisSchema } from '../ai/schemas/vault-semantic-analysis.schema';
import { createNoteSummarySchema } from '../ai/schemas/note-summary.schema';
import { createDomainClassificationSchema, KnowledgeSubdivision } from '../ai/schemas/domain-classification.schema';
import { createKnowledgeEvolutionSchema } from '../ai/schemas/knowledge-evolution.schema';
import { createRecommendedActionsSchema } from '../ai/schemas/recommended-actions.schema';

export interface TokenUsage {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
}

export interface AIResponse<T = string> {
    result: T;
    tokenUsage: TokenUsage;
}



export class AIModelService {
    private settings: GraphAnalysisSettings;
    private readonly RATE_LIMIT_DELAY = 2500; // 2.5 seconds between requests for 30 RPM
    private readonly MAX_RETRIES = 3;
    private readonly MODEL_NAME = 'gemini-flash-lite-latest';
    private readonly SEMANTIC_MODEL_NAME = 'gemma-3-27b-it';
    
    public getModelName(): string {
        return this.MODEL_NAME;
    }

    public getSemanticModelName(): string {
        return this.SEMANTIC_MODEL_NAME;
    }
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
     * Structured output analysis using the configured model with response schema
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
                    maxOutputTokens,
                    thinkingConfig: {
                        thinkingBudget: 0, // Disables thinking
                    }
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

    /**
     * Semantic analysis using Gemma 3 27B for token-heavy vault-wide tasks.
     * Uses prompt-based JSON extraction because Gemma 3 does not support
     * native JSON mode (responseMimeType / responseSchema).
     */
    public async generateSemanticAnalysis<T>(
        prompt: string,
        responseSchema: any,
        maxOutputTokens: number = 8192,
        temperature: number = 0.3,
        topP: number = 0.72
    ): Promise<AIResponse<T>> {
        if (!this.genAI) {
            throw new Error('Gemini API key not configured. Please configure your API key in settings.');
        }

        const schemaDescription = this.schemaToPromptDescription(responseSchema);
        const augmentedPrompt = prompt +
            '\n\n--- RESPONSE FORMAT ---\n' +
            'Return ONLY valid JSON. Do not include markdown formatting (like ```json), greetings, or explanations. Just output the raw JSON.\n' +
            'IMPORTANT: Your output language MUST match the language of each input note. If a note is written in Chinese, respond in Chinese; if in English, respond in English; and so on for any other language.\n\n' +
            'Expected JSON Schema:\n' + schemaDescription + '\n';

        console.log(`Sending semantic analysis request to ${this.SEMANTIC_MODEL_NAME} (max tokens: ${maxOutputTokens})...`);
        console.log(`SEMANTIC PROMPT (${augmentedPrompt.length} chars):`);
        console.log(augmentedPrompt);

        try {
            const response = await this.genAI.models.generateContent({
                model: this.SEMANTIC_MODEL_NAME,
                contents: augmentedPrompt,
                config: {
                    temperature,
                    topP,
                    maxOutputTokens,
                }
            });

            const tokenUsage: TokenUsage = {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                candidatesTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            };

            const rawText = response.text?.trim() || '';

            if (!rawText) {
                console.error('Empty semantic response details:', {
                    responseDefined: !!response,
                    textProperty: response.text,
                    candidates: response.candidates?.length || 0,
                    tokenUsage: tokenUsage
                });
                throw new Error('Empty response from Gemini API - check API key, request format, or content policy restrictions');
            }

            const cleanedJson = this.cleanJsonResponse(rawText);

            let parsedResult: T;
            try {
                parsedResult = JSON.parse(cleanedJson) as T;
            } catch (parseError) {
                console.error('Failed to parse semantic response as JSON:', parseError);
                console.error('Raw response text:', rawText.substring(0, 500));
                throw new Error(`Failed to parse semantic response: ${(parseError as Error).message}`);
            }

            console.log(`SEMANTIC RESPONSE SUCCESS (${cleanedJson.length} chars, tokens: ${tokenUsage.totalTokens})`);
            console.log('Parsed result:', parsedResult);

            return {
                result: parsedResult,
                tokenUsage
            };

        } catch (error) {
            console.error(`${this.SEMANTIC_MODEL_NAME} semantic API error:`, error);

            const errorMessage = (error as Error).message;
            if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
                console.log(`Semantic analysis rate limited (${this.SEMANTIC_MODEL_NAME}). Retrying in 10 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                return this.generateSemanticAnalysis(prompt, responseSchema, maxOutputTokens, temperature, topP);
            }

            console.error('Semantic analysis error context:', {
                promptLength: prompt.length,
                maxOutputTokens,
                hasSchema: !!responseSchema
            });

            throw error;
        }
    }

    /**
     * Converts a Gemini-style schema object into a human-readable JSON template
     * for embedding in prompts (used by models that lack native JSON mode).
     */
    private schemaToPromptDescription(schema: any, indent: number = 0): string {
        const pad = '  '.repeat(indent);
        if (!schema || !schema.type) return `${pad}"unknown"`;

        switch (schema.type) {
            case 'STRING':
                return schema.description ? `"string — ${schema.description}"` : '"string"';
            case 'NUMBER':
            case 'INTEGER':
                return schema.description ? `"number — ${schema.description}"` : '"number"';
            case 'BOOLEAN':
                return '"boolean"';
            case 'ARRAY': {
                if (!schema.items) return '[]';
                const itemDesc = this.schemaToPromptDescription(schema.items, indent + 1);
                const constraints: string[] = [];
                if (schema.minItems !== undefined) constraints.push(`minItems: ${schema.minItems}`);
                if (schema.maxItems !== undefined) constraints.push(`maxItems: ${schema.maxItems}`);
                const note = constraints.length > 0 ? `  // ${constraints.join(', ')}` : '';
                return `[${note}\n${pad}  ${itemDesc}\n${pad}]`;
            }
            case 'OBJECT': {
                if (!schema.properties) return '{}';
                const props = Object.entries(schema.properties)
                    .map(([key, propSchema]) => {
                        const val = this.schemaToPromptDescription(propSchema, indent + 1);
                        return `${pad}  "${key}": ${val}`;
                    })
                    .join(',\n');
                const requiredNote = schema.required
                    ? `  // required: ${JSON.stringify(schema.required)}`
                    : '';
                return `{${requiredNote}\n${props}\n${pad}}`;
            }
            default:
                return `"${schema.type}"`;
        }
    }

    /**
     * Strips markdown code fences that LLMs sometimes wrap around JSON output.
     */
    private cleanJsonResponse(text: string): string {
        let cleaned = text.trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
        cleaned = cleaned.replace(/```\s*$/i, '');
        return cleaned.trim();
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
     * Create response schema for knowledge evolution analysis
     */
    public createKnowledgeEvolutionSchema(): any {
        return createKnowledgeEvolutionSchema();
    }

    /**
     * Create response schema for recommended actions analysis
     */
    public createRecommendedActionsSchema(): any {
        return createRecommendedActionsSchema();
    }

    /**
     * Create response schema for domain classification with knowledge domain validation
     */
    public createDomainClassificationSchema(availableSubdivisions: KnowledgeSubdivision[]): any {
        return createDomainClassificationSchema(availableSubdivisions);
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