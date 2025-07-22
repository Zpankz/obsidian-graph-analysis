import { App, Notice, TFile } from 'obsidian';
import { GraphAnalysisSettings, HierarchicalDomain, DomainConnection } from '../types/types';
import { AIModelService, TokenUsage } from '../services/AIModelService';
import { KnowledgeStructureData, NetworkNode } from './visualization/KnowledgeStructureManager';
import { 
    KnowledgeEvolutionData,
    TimelineAnalysis,
    TopicPatternsAnalysis,
    FocusShiftAnalysis,
    LearningVelocityAnalysis,
    EvolutionInsight
} from './visualization/KnowledgeEvolutionManager';
import { KnowledgeActionsData } from './visualization/KnowledgeActionsManager';

// Remove re-export since we now import directly from types.ts

export interface VaultAnalysisResult {
    id: string;
    title: string;
    summary: string;
    keywords: string;
    knowledgeDomains: string[]; // Changed from knowledgeDomain string to knowledgeDomains string array
    created: string;
    modified: string;
    path: string;
    wordCount: number;
    graphMetrics?: {
        degreeCentrality?: number;
        betweennessCentrality?: number;
        closenessCentrality?: number;
        eigenvectorCentrality?: number;
    };
    centralityRankings?: {
        betweennessRank?: number;
        closenessRank?: number;
        eigenvectorRank?: number;
        degreeRank?: number;
    };
    knowledgeDomainNames?: string[];
}

export interface VaultAnalysisData {
    generatedAt: string;
    totalFiles: number;
    apiProvider: string;
    tokenUsage: TokenUsage;
    results: VaultAnalysisResult[];
}

/**
 * @deprecated Use tab-specific analysis data interfaces (StructureAnalysisData, EvolutionAnalysisData, ActionsAnalysisData) instead.
 */
export interface MasterAnalysisData {
    generatedAt: string;
    sourceAnalysisId: string; // Reference to vault-analysis.json used
    apiProvider: string;
    tokenUsage: TokenUsage;
    // rawAIResponse field removed as it's no longer needed
    
    // Tab 2: Knowledge Structure
    knowledgeStructure: KnowledgeStructureData;
    
    // Tab 3: Knowledge Evolution  
    knowledgeEvolution: KnowledgeEvolutionData;
    
    // Tab 4: Recommended Actions
    recommendedActions: KnowledgeActionsData;
}

// NEW: Interface for tab-specific analysis data
export interface TabAnalysisData {
    generatedAt: string;
    sourceAnalysisId: string;
    apiProvider: string;
    tokenUsage: TokenUsage;
}

// NEW: Interface for knowledge structure tab analysis
export interface StructureAnalysisData extends TabAnalysisData {
    knowledgeStructure: KnowledgeStructureData;
}

// NEW: Interface for knowledge evolution tab analysis
export interface EvolutionAnalysisData extends TabAnalysisData {
    knowledgeEvolution: KnowledgeEvolutionData;
}

// NEW: Interface for recommended actions tab analysis
export interface ActionsAnalysisData extends TabAnalysisData {
    recommendedActions: KnowledgeActionsData;
}

// DDC Template interfaces - UPDATED for new structured ID system
interface DDCSection {
    id: string;
    name: string;
}

interface DDCDivision {
    id: string;
    name: string;
    sections: DDCSection[];
}

interface DDCClass {
    id: string;
    name: string;
    divisions: DDCDivision[];
}

interface DDCTemplate {
    ddc_23_summaries: {
        title: string;
        classes: DDCClass[];
    };
}

export class MasterAnalysisManager {
    private app: App;
    private settings: GraphAnalysisSettings;
    private aiService: AIModelService;
    
    // DDC data loaded from external JSON file - UPDATED for new structure
    private ddcTemplate: DDCTemplate | null = null;
    private ddcMainClasses: { [key: string]: string } = {};
    private ddcDivisions: { [key: string]: string } = {};
    private ddcSections: { [key: string]: string } = {};
    
    // NEW: Optimized section list for AI classification
    private ddcSectionsList: Array<{id: string, name: string, division: string, mainClass: string}> = [];

    constructor(app: App, settings: GraphAnalysisSettings) {
        this.app = app;
        this.settings = settings;
        this.aiService = new AIModelService(settings);
    }

    /**
     * NEW: Helper function to get all section-level domains (third level)
     */
    public getAllDDCSections(): Array<{id: string, name: string, division: string, mainClass: string}> {
        return this.ddcSectionsList;
    }

    /**
     * Load DDC template from external JSON file and extract optimized section list
     */
    private async loadDDCTemplate(): Promise<void> {
        if (this.ddcTemplate) {
            console.log('DDC template already loaded, skipping load');
            return; // Already loaded
        }

        try {
            // Check if template exists in plugin root directory
            const templatePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/DDC-template.json`;
            console.log('Attempting to load DDC template from:', templatePath);
            
            let ddcContent: string | null = null;
            
            try {
                ddcContent = await this.app.vault.adapter.read(templatePath);
                console.log(`Successfully loaded DDC template from: ${templatePath}`);
            } catch (pathError) {
                console.log(`DDC template not found at: ${templatePath}`);
                throw new Error('DDC template not found in the plugin directory. Please ensure the DDC-template.json file is properly copied to the plugin directory during installation.');
            }
            
            try {
                this.ddcTemplate = JSON.parse(ddcContent);
                console.log('Successfully parsed DDC template JSON');
            } catch (parseError) {
                console.error('Failed to parse DDC template JSON:', parseError);
                console.log('DDC content preview:', ddcContent.substring(0, 200) + '...');
                throw new Error(`Failed to parse DDC template JSON: ${parseError.message}`);
            }
            
            // Extract classes, divisions, and sections for the new structure
            this.ddcMainClasses = {};
            this.ddcDivisions = {};
            this.ddcSections = {};
            this.ddcSectionsList = []; // Reset the optimized list
            
            if (this.ddcTemplate?.ddc_23_summaries?.classes) {
                const classCount = this.ddcTemplate.ddc_23_summaries.classes.length;
                
                this.ddcTemplate.ddc_23_summaries.classes.forEach(ddcClass => {
                    // Store main class
                    this.ddcMainClasses[ddcClass.id] = ddcClass.name;
                    
                    // Process divisions
                    const divisionCount = ddcClass.divisions.length;
                    
                    ddcClass.divisions.forEach(division => {
                        this.ddcDivisions[division.id] = division.name;
                        
                        // Process sections and build optimized list
                        const sectionCount = division.sections.length;
                        
                        division.sections.forEach(section => {
                            this.ddcSections[section.id] = section.name;
                            
                            // Add to optimized sections list with parent information
                            this.ddcSectionsList.push({
                                id: section.id,
                                name: section.name,
                                division: division.name,
                                mainClass: ddcClass.name
                            });
                        });
                    });
                });
                
                console.log(`📚 DDC template loaded from ${templatePath}: ${this.ddcTemplate.ddc_23_summaries.classes.length} main classes, ${Object.keys(this.ddcDivisions).length} divisions, ${Object.keys(this.ddcSections).length} sections`);
                console.log(`🎯 Optimized sections list: ${this.ddcSectionsList.length} leaf nodes for AI classification`);
            } else {
                console.error('DDC template has invalid structure:', this.ddcTemplate);
                throw new Error('DDC template has invalid structure. Expected ddc_23_summaries.classes array.');
            }
        } catch (error) {
            console.error('Failed to load DDC template:', error);
            // Fallback to empty structure
            this.ddcTemplate = null;
            this.ddcMainClasses = {};
            this.ddcDivisions = {};
            this.ddcSections = {};
            this.ddcSectionsList = [];
        }
    }

    // NEW: Ensure responses directory exists
    private async ensureResponsesDirectory(): Promise<void> {
        try {
            const responsesDir = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/responses`;
            try {
                await this.app.vault.adapter.mkdir(responsesDir);
            } catch {
                // Directory might already exist
            }
        } catch (error) {
            console.error('Failed to create responses directory:', error);
        }
    }

    // Update loadCachedTabAnalysis to ensure responses directory exists
    public async loadCachedTabAnalysis(tabName: string): Promise<TabAnalysisData | null> {
        try {
            // Ensure responses directory exists
            await this.ensureResponsesDirectory();
            
            // Look for the tab-specific analysis in the responses directory
            const filePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/responses/${tabName}-analysis.json`;
            const content = await this.app.vault.adapter.read(filePath);
            const data = JSON.parse(content);
            
            // Validate that the cached analysis matches current semantic analysis
            const currentAnalysisData = await this.loadVaultAnalysisData();
            if (currentAnalysisData && data?.sourceAnalysisId !== this.generateAnalysisId(currentAnalysisData)) {
                console.log(`Cached ${tabName} analysis is outdated, will regenerate`);
                return null;
            }
            
            return data;
        } catch (error) {
            // Check if this is a file not found error (ENOENT)
            if (error.code === 'ENOENT') {
                console.log(`No cached ${tabName} analysis found yet. This is normal for first-time use.`);
            } else {
                // Log other unexpected errors
                console.warn(`Error loading cached ${tabName} analysis:`, error);
            }
            return null;
        }
    }

    private async loadVaultAnalysisData(): Promise<VaultAnalysisData | null> {
        try {
            const filePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/vault-analysis.json`;
            const content = await this.app.vault.adapter.read(filePath);
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    private generateAnalysisId(analysisData: VaultAnalysisData): string {
        return `${analysisData.generatedAt}_${analysisData.totalFiles}`;
    }

    /**
     * Validate that network node data contains real notes from the vault
     */
    private validateNetworkNodeData(knowledgeNetwork: any, analysisData: VaultAnalysisData): void {
        const vaultNotes = new Map(analysisData.results.map(note => [note.path, note]));
        const vaultTitles = new Set(analysisData.results.map(note => note.title));
        
        const categories = ['bridges', 'foundations', 'authorities'];
        let issuesFound = 0;
        
        categories.forEach(category => {
            if (knowledgeNetwork[category] && Array.isArray(knowledgeNetwork[category])) {
                knowledgeNetwork[category].forEach((domain: any, domainIndex: number) => {
                    if (domain.topNotes && Array.isArray(domain.topNotes)) {
                        domain.topNotes.forEach((note: any, noteIndex: number) => {
                            // Check for dummy/example data
                            if (note.title === 'Note Title' || 
                                note.path === 'path/to/note.md' ||
                                note.title?.includes('Example') ||
                                note.title?.includes('Sample')) {
                                console.warn(`⚠️  Dummy note detected in ${category}[${domainIndex}].topNotes[${noteIndex}]: "${note.title}"`);
                                issuesFound++;
                                return;
                            }
                            
                            // Validate note exists in vault
                            if (!vaultNotes.has(note.path)) {
                                console.warn(`⚠️  Note path not found in vault: "${note.path}" (title: "${note.title}")`);
                                
                                // Try to find by title
                                if (vaultTitles.has(note.title)) {
                                    const matchingNote = analysisData.results.find(n => n.title === note.title);
                                    if (matchingNote) {
                                        console.log(`✅ Found note by title, correcting path: "${note.path}" → "${matchingNote.path}"`);
                                        note.path = matchingNote.path;
                                    }
                                } else {
                                    console.warn(`❌ Note title also not found in vault: "${note.title}"`);
                                    issuesFound++;
                                }
                            } else {
                                // Validate title matches path
                                const vaultNote = vaultNotes.get(note.path);
                                if (vaultNote && vaultNote.title !== note.title) {
                                    console.warn(`⚠️  Title mismatch for path "${note.path}": AI says "${note.title}", vault has "${vaultNote.title}"`);
                                    // Correct the title
                                    note.title = vaultNote.title;
                                }
                            }
                        });
                    }
                });
            }
        });
        
        if (issuesFound > 0) {
            console.warn(`🔍 Found ${issuesFound} note data issues. Check console for details.`);
            console.log('💡 Tip: If you see dummy data, try regenerating the AI analysis.');
        } else {
            console.log('✅ All note data validated successfully against vault contents.');
        }
    }

    /**
     * Build hierarchical domain structure directly from vault analysis data
     * This builds a 3-level hierarchy: Main Class > Division > Section
     */
    public buildHierarchyFromVaultData(
        analysisData: VaultAnalysisData
    ): HierarchicalDomain[] {
        // Create maps for DDC hierarchy - we'll only use class and section now
        const classMap = new Map<string, HierarchicalDomain>();
        const sectionMap = new Map<string, HierarchicalDomain>();
        
        // Count notes per DDC section
        const sectionCounts = new Map<string, number>();
        const sectionNotes = new Map<string, VaultAnalysisResult[]>();
        
        // Get DDC name to code mapping for reverse lookup
        const nameToCodeMap = new Map<string, string>();
        const codeToNameMap = this.getDDCCodeToNameMap();
        
        // Add main class names to the code-to-name map
        if (this.ddcTemplate && this.ddcTemplate.ddc_23_summaries && this.ddcTemplate.ddc_23_summaries.classes) {
            this.ddcTemplate.ddc_23_summaries.classes.forEach(cls => {
                // Store main class names with their IDs (0, 1, 2, etc.)
                codeToNameMap.set(cls.id, cls.name);
            });
        }
        
        // Build reverse lookup map
        codeToNameMap.forEach((name, code) => {
            nameToCodeMap.set(name, code);
        });
        
        // Process each note to extract its DDC codes or names
        analysisData.results.forEach(note => {
            if (note.knowledgeDomains && note.knowledgeDomains.length > 0) {
                // Process each domain in the array
                note.knowledgeDomains.forEach(domain => {
                    let sectionId = '';
                    // Try to use domain as a DDC code first
                    if (this.isValidDDCSectionId(domain)) {
                        sectionId = domain;
                    } 
                    // If not a valid code, try to look up by name
                    else if (nameToCodeMap.has(domain)) {
                        sectionId = nameToCodeMap.get(domain) || '';
                    } 
                    // If still not found, skip this domain (do NOT create synthetic IDs)
                    else {
                        // Skip this domain
                        return;
                    }
                    // Skip if we couldn't determine a section ID
                    if (!sectionId) return;
                    // Get class ID from section ID
                    const classId = this.getClassIdFromSection(sectionId);
                    // Update section counts
                    sectionCounts.set(sectionId, (sectionCounts.get(sectionId) || 0) + 1);
                    // Update section notes
                    if (!sectionNotes.has(sectionId)) {
                        sectionNotes.set(sectionId, []);
                    }
                    sectionNotes.get(sectionId)?.push(note);
                    // Create class node if it doesn't exist
                    if (!classMap.has(classId)) {
                        // Get the proper name for the class - for standard DDC classes (0-9),
                        // this will be the proper main class name
                        const className = codeToNameMap.get(classId) || classId;
                        classMap.set(classId, {
                            ddcCode: classId,
                            name: className,
                            noteCount: 0,
                            level: 1, // Main class level
                            children: []
                        });
                    }
                    // Create section node if it doesn't exist
                    if (!sectionMap.has(sectionId)) {
                        const sectionNode: HierarchicalDomain = {
                            ddcCode: sectionId,
                            name: codeToNameMap.get(sectionId) || sectionId,
                            noteCount: 0,
                            level: 2, // Section level (was 3 before)
                            parent: classMap.get(classId)?.ddcCode // Fix: Use ddcCode string instead of the HierarchicalDomain object
                        };
                        sectionMap.set(sectionId, sectionNode);
                        // Add section as child of class
                        classMap.get(classId)?.children?.push(sectionNode);
                    }
                    // Update note count for section and class
                    if (sectionMap.has(sectionId)) {
                        const section = sectionMap.get(sectionId);
                        if (section) {
                            section.noteCount = (section.noteCount || 0) + 1;
                        }
                    }
                    if (classMap.has(classId)) {
                        const classNode = classMap.get(classId);
                        if (classNode) {
                            classNode.noteCount = (classNode.noteCount || 0) + 1;
                        }
                    }
                });
            }
        });
        
        // Extract keywords for each section
        sectionMap.forEach((section, sectionId) => {
            const notes = sectionNotes.get(sectionId) || [];
            const keywords = new Set<string>();
            
            notes.forEach(note => {
                if (note.keywords) {
                    note.keywords.split(',').forEach(keyword => {
                        const trimmed = keyword.trim();
                        if (trimmed) {
                            keywords.add(trimmed);
                        }
                    });
                }
            });
            
            section.keywords = Array.from(keywords); // Fix: Use string array instead of comma-joined string
        });
        
        // Convert class map to array and sort by note count
        const result = Array.from(classMap.values())
            .filter(cls => cls.noteCount && cls.noteCount > 0)
            .sort((a, b) => (b.noteCount || 0) - (a.noteCount || 0));
        
        return result;
    }

    /**
     * Helper methods to extract IDs from section IDs - UPDATED for new structured ID system
     */
    private getClassIdFromSection(sectionId: string): string {
        // Extract class ID from section ID (e.g., "0-0-0" -> "0")
        return sectionId.split('-')[0];
    }

    private getDivisionIdFromSection(sectionId: string): string {
        // Extract division ID from section ID (e.g., "0-0-0" -> "0-0")
        const parts = sectionId.split('-');
        return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : sectionId;
    }

    public updateSettings(settings: GraphAnalysisSettings): void {
        this.settings = settings;
        this.aiService.updateSettings(settings);
    }

 
    /**
     * Check if a section ID is valid in the DDC template
     */
    private isValidDDCSectionId(sectionId: string): boolean {
        // First check if it's in our loaded sections list
        if (this.ddcSections[sectionId]) {
            return true;
        }
        
        // Try to normalize the section ID format
        let normalizedId = sectionId;
        
        // Handle formats like "004" or "4" instead of "0-0-4"
        if (!sectionId.includes('-')) {
            // Try to convert numeric format to DDC format
            if (sectionId.length === 3) {
                // Format like "004" -> "0-0-4"
                normalizedId = `${sectionId[0]}-${sectionId[1]}-${sectionId[2]}`;
            } else if (sectionId.length === 1) {
                // Format like "4" -> "0-0-4" (assuming it's in the first division)
                normalizedId = `0-0-${sectionId}`;
            }
        }
        
        // Check if normalized ID is valid
        if (this.ddcSections[normalizedId]) {
            console.log(`Normalized section ID ${sectionId} to ${normalizedId}`);
            return true;
        }
        
        // If still not found, try to match by extracting numbers
        const numbers = sectionId.match(/\d+/g);
        if (numbers && numbers.length === 3) {
            const constructed = `${numbers[0]}-${numbers[1]}-${numbers[2]}`;
            if (this.ddcSections[constructed]) {
                console.log(`Constructed valid section ID ${constructed} from ${sectionId}`);
                return true;
            }
        }
        
        return false;
    }

    /**
     * NEW: Get section information by ID
     */
    public getDDCSectionInfo(sectionId: string): {id: string, name: string, division: string, mainClass: string} | null {
        return this.ddcSectionsList.find(section => section.id === sectionId) || null;
    }

    /**
     * NEW: Get all sections within a specific division
     */
    public getSectionsInDivision(divisionId: string): Array<{id: string, name: string, division: string, mainClass: string}> {
        return this.ddcSectionsList.filter(section => 
            this.getDivisionIdFromSection(section.id) === divisionId
        );
    }

    /**
     * NEW: Get all sections within a specific class
     */
    public getSectionsInClass(classId: string): Array<{id: string, name: string, division: string, mainClass: string}> {
        return this.ddcSectionsList.filter(section => 
            this.getClassIdFromSection(section.id) === classId
        );
    }

    /**
     * Get a map from DDC section code to section name
     */
    public getDDCCodeToNameMap(): Map<string, string> {
        const map = new Map<string, string>();
        
        // Add section names from the sections list
        this.ddcSectionsList.forEach(section => {
            map.set(section.id, section.name);
        });
        
        // Add main class names from the DDC template
        if (this.ddcTemplate && this.ddcTemplate.ddc_23_summaries && this.ddcTemplate.ddc_23_summaries.classes) {
            this.ddcTemplate.ddc_23_summaries.classes.forEach(cls => {
                map.set(cls.id, cls.name);
            });
        }
        
        // Add any manually defined class and division names
        Object.entries(this.ddcMainClasses).forEach(([code, name]) => {
            map.set(code, name);
        });
        
        Object.entries(this.ddcDivisions).forEach(([code, name]) => {
            map.set(code, name);
        });
        
        Object.entries(this.ddcSections).forEach(([code, name]) => {
            map.set(code, name);
        });
        
        return map;
    }

    // NEW: Generate Knowledge Structure Analysis using structured output
    public async generateKnowledgeStructureAnalysis(): Promise<StructureAnalysisData> {
        try {
            console.log('Generating Knowledge Structure Analysis with structured output...');
            
            const analysisData = await this.loadVaultAnalysisData();
            if (!analysisData) {
                throw new Error('No vault analysis data found. Please generate vault analysis first.');
            }
            
            // Build the system, context, and instruction like in test-ai-model.js
            const system = "You are an expert in knowledge management. You are highly skilled in applying graph theory and network analysis to knowledge graphs. Use your expertise to extract insights from the provided context which contains knowledge domains and centrality rankings. Please focus on network analysis and determining knowledge gaps.";
            
            const context = `VAULT ANALYSIS DATA:
${JSON.stringify(analysisData)}`;
            
            const instruction = `Analyze the vault data to identify key knowledge domains using network centrality metrics. Return a JSON object matching the required schema.

**Network Analysis Framework:**
- **Knowledge Bridges** (Betweenness Centrality): Domains that connect disparate knowledge areas and facilitate interdisciplinary thinking
- **Knowledge Foundations** (Closeness Centrality): Core domains that are central to the knowledge network and serve as conceptual starting points  
- **Knowledge Authorities** (Eigenvector Centrality): Domains representing areas of expertise with deep interconnections to other important concepts

**Instructions:**
1. Identify top-ranking domains for each centrality type based on the provided data
2. For each domain, collect the contributing notes internally and output top 3 notes for each domain
3. Explain why each domain qualifies as a bridge/foundation/authority based on its network position
4. Use only domains explicitly present in the vault data - do not invent domains
5. Treat domains as independent entities (multiple domains from one note are separate)`;

            // Combine system, context, and instruction
            const prompt = `${system}\n\n${context}\n\n${instruction}`;
            
            // Get the response schema for knowledge network analysis
            const responseSchema = this.aiService.createKnowledgeNetworkSchema();
            
            // Use the new structured output method
            const response = await this.aiService.generateStructuredAnalysis<any>(
                prompt,
                responseSchema,
                8000, // maxOutputTokens
                0.3,  // temperature
                0.72  // topP
            );
            
            // Parse the structured response directly (it's already JSON)
            const structureData = this.parseStructuredKnowledgeNetwork(response.result, analysisData);
            
            // Create structured analysis data
            const tabData: StructureAnalysisData = {
                generatedAt: new Date().toISOString(),
                sourceAnalysisId: this.generateAnalysisId(analysisData),
                apiProvider: 'Google Gemini',
                tokenUsage: response.tokenUsage || { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
                knowledgeStructure: structureData
            };
            
            // Cache the results
            await this.cacheTabAnalysis('structure', tabData);
            
            return tabData;
        } catch (error) {
            console.error('Failed to generate Knowledge Structure Analysis:', error);
            throw error;
        }
    }

    /**
     * NEW: Parse structured knowledge network response (replaces old parseKnowledgeStructure)
     */
    private parseStructuredKnowledgeNetwork(structuredResponse: any, analysisData: VaultAnalysisData): KnowledgeStructureData {
        try {
            // The response is already parsed JSON from structured output
            const knowledgeNetwork = structuredResponse.knowledgeNetwork || {
                bridges: [],
                foundations: [],
                authorities: []
            };
            
            // Validate note data against vault analysis
            this.validateNetworkNodeData(knowledgeNetwork, analysisData);
            
            // Extract knowledge gaps
            const knowledgeGaps = structuredResponse.knowledgeGaps || [];
            
            return {
                knowledgeNetwork,
                gaps: knowledgeGaps
            };
        } catch (error) {
            console.error('Error parsing structured knowledge network:', error);
            console.error('Structured response:', structuredResponse);
            throw new Error(`Failed to parse structured knowledge network: ${error.message}`);
        }
    }

    // NEW: Cache tab-specific analysis
    private async cacheTabAnalysis(tabName: string, data: TabAnalysisData): Promise<void> {
        try {
            // Ensure responses directory exists
            await this.ensureResponsesDirectory();
            
            // Store the tab-specific analysis in the responses directory
            const filePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/responses/${tabName}-analysis.json`;
            await this.app.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
            console.log(`${tabName} analysis cached successfully in responses directory`);
        } catch (error) {
            console.error(`Failed to cache ${tabName} analysis:`, error);
        }
    }

    /**
     * Public method to ensure the DDC template is loaded
     * This can be called from other classes to ensure the template is loaded before using it
     */
    public async ensureDDCTemplateLoaded(): Promise<boolean> {
        if (this.ddcTemplate) {
            return true; // Already loaded
        }
        
        try {
            await this.loadDDCTemplate();
            return this.ddcTemplate !== null;
        } catch (error) {
            console.error('Failed to load DDC template:', error);
            return false;
        }
    }

    /**
     * Create initial structure-analysis.json file with empty knowledgeNetwork and knowledgeGaps
     */
    public async createInitialStructureAnalysis(): Promise<StructureAnalysisData | null> {
        try {
            console.log('Creating initial Knowledge Structure Analysis...');
            
            const analysisData = await this.loadVaultAnalysisData();
            if (!analysisData) {
                console.warn('No vault analysis data found. Cannot create initial structure analysis.');
                return null;
            }
            
            // Create empty structure data
            const structureData: KnowledgeStructureData = {
                knowledgeNetwork: {
                    bridges: [],
                    foundations: [],
                    authorities: []
                },
                gaps: []
            };
            
            // Create structured analysis data
            const tabData: StructureAnalysisData = {
                generatedAt: new Date().toISOString(),
                sourceAnalysisId: this.generateAnalysisId(analysisData),
                apiProvider: 'Google Gemini',
                tokenUsage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
                knowledgeStructure: structureData
            };
            
            // Cache the results
            await this.cacheTabAnalysis('structure', tabData);
            
            console.log('Initial structure analysis created successfully');
            return tabData;
        } catch (error) {
            console.error('Failed to create initial Knowledge Structure Analysis:', error);
            return null;
        }
    }

    // TODO: Implement these methods tomorrow with structured output approach
    
    /**
     * TODO: Generate Knowledge Evolution Analysis using structured output (to be implemented)
     */
    public async generateKnowledgeEvolutionAnalysis(): Promise<EvolutionAnalysisData> {
        throw new Error('Knowledge Evolution Analysis not yet implemented with structured output. Will be implemented tomorrow.');
    }

    /**
     * TODO: Generate Recommended Actions Analysis using structured output (to be implemented)
     */
    public async generateRecommendedActionsAnalysis(): Promise<ActionsAnalysisData> {
        throw new Error('Recommended Actions Analysis not yet implemented with structured output. Will be implemented tomorrow.');
    }
}