import { VaultAnalysisData, VaultAnalysisResult } from '../ai/MasterAnalysisManager';
import { KDECalculationService } from '../utils/KDECalculationService';

/**
 * Configuration for AI context preparation
 */
export interface AIContextConfig {
    binSize: 0.01 | 0.05 | 0.1;  // Default: 0.05
    topKPerCentrality: number;   // Default: 15
    includeMultiCentralityHubs: boolean;  // Default: true
    includeRepresentativeNotes: boolean;  // Default: true
}

export const DEFAULT_AICONTEXT_CONFIG: AIContextConfig = {
    binSize: 0.05,
    topKPerCentrality: 15,
    includeMultiCentralityHubs: true,
    includeRepresentativeNotes: true
};

/**
 * Top note with centrality score and metadata
 */
export interface TopNote {
    id: string;
    title: string;
    path: string;
    score: number;
    rank: number;
    keywords: string;
    domains: string[];
}

/**
 * Interval summary for aggregated centrality bins
 */
export interface IntervalSummary {
    range: string;        // "0.05-0.10"
    noteCount: number;
    topKeywords: string[];
    topDomains: string[];
    representativeNote?: string;
}

/**
 * Domain distribution summary
 */
export interface DomainSummary {
    domain: string;
    noteCount: number;
    avgBetweenness: number;
    avgCloseness: number;
    avgEigenvector: number;
}

/**
 * Optimized AI context structure
 */
export interface OptimizedAIContext {
    metadata: {
        totalNotes: number;
        analyzedNotes: number;
        dateRange?: string;
    };
    topNotes: {
        betweenness: TopNote[];
        closeness: TopNote[];
        eigenvector: TopNote[];
        multiCentralityHubs?: TopNote[];
    };
    intervalSummaries: {
        betweenness: IntervalSummary[];
        closeness: IntervalSummary[];
        eigenvector: IntervalSummary[];
    };
    domainDistribution: DomainSummary[];
}

/**
 * Service for preparing optimized context for AI analysis
 */
export class AIContextPreparationService {
    private config: AIContextConfig;
    private kdeService: KDECalculationService;

    constructor(config: Partial<AIContextConfig> = {}) {
        this.config = { ...DEFAULT_AICONTEXT_CONFIG, ...config };
        this.kdeService = new KDECalculationService();
    }

    /**
     * Prepare optimized context from vault analysis data
     */
    public prepareOptimizedContext(analysisData: VaultAnalysisData): OptimizedAIContext {
        const results = analysisData.results.filter(r => r.graphMetrics);

        // Extract metadata
        const metadata = this.extractMetadata(analysisData, results);

        // Extract top-k notes per centrality
        const topNotes = {
            betweenness: this.extractTopNotes(results, 'betweennessCentrality', this.config.topKPerCentrality),
            closeness: this.extractTopNotes(results, 'closenessCentrality', this.config.topKPerCentrality),
            eigenvector: this.extractTopNotes(results, 'eigenvectorCentrality', this.config.topKPerCentrality),
            multiCentralityHubs: this.config.includeMultiCentralityHubs 
                ? this.extractMultiCentralityHubs(results, this.config.topKPerCentrality)
                : undefined
        };

        // Generate interval summaries
        const intervalSummaries = {
            betweenness: this.generateIntervalSummaries(results, 'betweennessCentrality', this.config.binSize),
            closeness: this.generateIntervalSummaries(results, 'closenessCentrality', this.config.binSize),
            eigenvector: this.generateIntervalSummaries(results, 'eigenvectorCentrality', this.config.binSize)
        };

        // Calculate domain distribution
        const domainDistribution = this.calculateDomainDistribution(results);

        return {
            metadata,
            topNotes,
            intervalSummaries,
            domainDistribution
        };
    }

    /**
     * Extract compact metadata
     */
    private extractMetadata(analysisData: VaultAnalysisData, results: VaultAnalysisResult[]): OptimizedAIContext['metadata'] {
        const dates = results
            .map(r => new Date(r.created))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        let dateRange: string | undefined;
        if (dates.length > 0) {
            const start = dates[0].toISOString().substring(0, 7); // YYYY-MM
            const end = dates[dates.length - 1].toISOString().substring(0, 7);
            dateRange = start === end ? start : `${start} to ${end}`;
        }

        return {
            totalNotes: analysisData.totalFiles,
            analyzedNotes: results.length,
            dateRange
        };
    }

    /**
     * Extract top-k notes for a specific centrality type
     */
    public extractTopNotes(
        results: VaultAnalysisResult[],
        centralityType: 'betweennessCentrality' | 'closenessCentrality' | 'eigenvectorCentrality',
        k: number
    ): TopNote[] {
        // Filter and map notes with centrality scores
        const notesWithScores = results
            .map((result, index) => {
                const score = result.graphMetrics?.[centralityType];
                const rank = result.centralityRankings?.[
                    centralityType === 'betweennessCentrality' ? 'betweennessRank' :
                    centralityType === 'closenessCentrality' ? 'closenessRank' :
                    'eigenvectorRank'
                ];

                if (score === undefined || score === null || score <= 0) {
                    return null;
                }

                return {
                    result,
                    score,
                    rank: rank ?? index + 1
                };
            })
            .filter((item): item is { result: VaultAnalysisResult; score: number; rank: number } => item !== null)
            .sort((a, b) => b.score - a.score) // Sort descending by score
            .slice(0, k);

        return notesWithScores.map((item, index) => ({
            id: item.result.id,
            title: item.result.title,
            path: item.result.path,
            score: item.score,
            rank: index + 1, // Re-rank after sorting
            keywords: item.result.keywords,
            domains: item.result.knowledgeDomains || []
        }));
    }

    /**
     * Extract notes that rank high in multiple centrality types (hubs)
     */
    private extractMultiCentralityHubs(results: VaultAnalysisResult[], k: number): TopNote[] {
        // Calculate percentile thresholds for each centrality
        const betweennessScores = results
            .map(r => r.graphMetrics?.betweennessCentrality)
            .filter((s): s is number => s !== undefined && s !== null && s > 0)
            .sort((a, b) => b - a);
        
        const closenessScores = results
            .map(r => r.graphMetrics?.closenessCentrality)
            .filter((s): s is number => s !== undefined && s !== null && s > 0)
            .sort((a, b) => b - a);
        
        const eigenvectorScores = results
            .map(r => r.graphMetrics?.eigenvectorCentrality)
            .filter((s): s is number => s !== undefined && s !== null && s > 0)
            .sort((a, b) => b - a);

        // Top 10% threshold for each centrality
        const top10PercentIndex = Math.max(1, Math.floor(betweennessScores.length * 0.1));
        const betweennessThreshold = betweennessScores[top10PercentIndex - 1] || 0;
        const closenessThreshold = closenessScores[top10PercentIndex - 1] || 0;
        const eigenvectorThreshold = eigenvectorScores[top10PercentIndex - 1] || 0;

        // Find notes that rank high in 2+ centralities
        const hubs = results
            .map(result => {
                const betweenness = result.graphMetrics?.betweennessCentrality || 0;
                const closeness = result.graphMetrics?.closenessCentrality || 0;
                const eigenvector = result.graphMetrics?.eigenvectorCentrality || 0;

                const highCount = [
                    betweenness >= betweennessThreshold,
                    closeness >= closenessThreshold,
                    eigenvector >= eigenvectorThreshold
                ].filter(Boolean).length;

                if (highCount < 2) return null;

                // Calculate composite score (average of high centralities)
                const scores = [betweenness, closeness, eigenvector].filter(s => s > 0);
                const compositeScore = scores.reduce((a, b) => a + b, 0) / scores.length;

                return {
                    result,
                    compositeScore,
                    highCount
                };
            })
            .filter((item): item is { result: VaultAnalysisResult; compositeScore: number; highCount: number } => item !== null)
            .sort((a, b) => {
                // Sort by highCount first, then compositeScore
                if (a.highCount !== b.highCount) {
                    return b.highCount - a.highCount;
                }
                return b.compositeScore - a.compositeScore;
            })
            .slice(0, k);

        return hubs.map((item, index) => ({
            id: item.result.id,
            title: item.result.title,
            path: item.result.path,
            score: item.compositeScore,
            rank: index + 1,
            keywords: item.result.keywords,
            domains: item.result.knowledgeDomains || []
        }));
    }

    /**
     * Generate interval summaries for a centrality type
     */
    public generateIntervalSummaries(
        results: VaultAnalysisResult[],
        centralityType: 'betweennessCentrality' | 'closenessCentrality' | 'eigenvectorCentrality',
        binSize: number
    ): IntervalSummary[] {
        // Filter notes with valid centrality scores
        const notesWithScores = results
            .map(result => ({
                result,
                score: result.graphMetrics?.[centralityType]
            }))
            .filter((item): item is { result: VaultAnalysisResult; score: number } => 
                item.score !== undefined && item.score !== null && item.score >= 0
            );

        if (notesWithScores.length === 0) {
            return [];
        }

        // Find max value to determine bin range
        const maxScore = Math.max(...notesWithScores.map(item => item.score));
        const upperBound = Math.ceil(maxScore / binSize) * binSize;
        const numBins = Math.ceil(upperBound / binSize);

        // Group notes into bins
        const bins: Map<number, VaultAnalysisResult[]> = new Map();
        
        notesWithScores.forEach(({ result, score }) => {
            const binIndex = Math.min(Math.floor(score / binSize), numBins - 1);
            if (!bins.has(binIndex)) {
                bins.set(binIndex, []);
            }
            bins.get(binIndex)!.push(result);
        });

        // Generate summaries for non-empty bins
        const summaries: IntervalSummary[] = [];
        
        for (let i = 0; i < numBins; i++) {
            const notes = bins.get(i);
            if (!notes || notes.length === 0) continue;

            const min = i * binSize;
            const max = Math.min((i + 1) * binSize, upperBound);
            const range = `${min.toFixed(2)}-${max.toFixed(2)}`;

            // Aggregate keywords
            const keywordCounts = new Map<string, number>();
            notes.forEach(note => {
                const keywords = note.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
                keywords.forEach(keyword => {
                    keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
                });
            });
            const topKeywords = Array.from(keywordCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([keyword]) => keyword);

            // Aggregate domains
            const domainCounts = new Map<string, number>();
            notes.forEach(note => {
                (note.knowledgeDomains || []).forEach(domain => {
                    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
                });
            });
            const topDomains = Array.from(domainCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([domain]) => domain);

            // Select representative note (highest score in bin, or first if config disabled)
            let representativeNote: string | undefined;
            if (this.config.includeRepresentativeNotes) {
                const sortedNotes = [...notes].sort((a, b) => {
                    const scoreA = a.graphMetrics?.[centralityType] || 0;
                    const scoreB = b.graphMetrics?.[centralityType] || 0;
                    return scoreB - scoreA;
                });
                representativeNote = sortedNotes[0]?.title;
            }

            summaries.push({
                range,
                noteCount: notes.length,
                topKeywords,
                topDomains,
                representativeNote
            });
        }

        return summaries;
    }

    /**
     * Calculate domain distribution summary
     */
    public calculateDomainDistribution(results: VaultAnalysisResult[]): DomainSummary[] {
        const domainMap = new Map<string, {
            notes: VaultAnalysisResult[];
            betweennessSum: number;
            closenessSum: number;
            eigenvectorSum: number;
        }>();

        results.forEach(result => {
            const domains = result.knowledgeDomains || [];
            domains.forEach(domain => {
                if (!domainMap.has(domain)) {
                    domainMap.set(domain, {
                        notes: [],
                        betweennessSum: 0,
                        closenessSum: 0,
                        eigenvectorSum: 0
                    });
                }

                const domainData = domainMap.get(domain)!;
                domainData.notes.push(result);

                const betweenness = result.graphMetrics?.betweennessCentrality || 0;
                const closeness = result.graphMetrics?.closenessCentrality || 0;
                const eigenvector = result.graphMetrics?.eigenvectorCentrality || 0;

                domainData.betweennessSum += betweenness;
                domainData.closenessSum += closeness;
                domainData.eigenvectorSum += eigenvector;
            });
        });

        return Array.from(domainMap.entries())
            .map(([domain, data]) => ({
                domain,
                noteCount: data.notes.length,
                avgBetweenness: data.betweennessSum / data.notes.length,
                avgCloseness: data.closenessSum / data.notes.length,
                avgEigenvector: data.eigenvectorSum / data.notes.length
            }))
            .sort((a, b) => b.noteCount - a.noteCount); // Sort by note count descending
    }

    /**
     * Format optimized context for AI consumption
     */
    public formatForAI(context: OptimizedAIContext, comprehensiveStats: string): string {
        const sections: string[] = [];

        // Metadata
        sections.push('=== VAULT METADATA ===');
        sections.push(`Total Notes: ${context.metadata.totalNotes}`);
        sections.push(`Analyzed Notes: ${context.metadata.analyzedNotes}`);
        if (context.metadata.dateRange) {
            sections.push(`Date Range: ${context.metadata.dateRange}`);
        }
        sections.push('');

        // Statistical Summary (from KDE service)
        sections.push('=== CENTRALITY DISTRIBUTION ANALYSIS (Comprehensive Statistics) ===');
        sections.push(comprehensiveStats);
        sections.push('');

        // Top-K Notes per Centrality
        sections.push('=== TOP NOTES BY CENTRALITY ===');
        
        ['betweenness', 'closeness', 'eigenvector'].forEach(centralityType => {
            const notes = context.topNotes[centralityType as keyof typeof context.topNotes] as TopNote[];
            if (notes.length === 0) return;

            sections.push(`\n${centralityType.toUpperCase()} Centrality (Top ${notes.length}):`);
            notes.forEach(note => {
                sections.push(`  ${note.rank}. ${note.title} (${note.path})`);
                sections.push(`     Score: ${note.score.toFixed(4)}, Keywords: ${note.keywords}, Domains: ${note.domains.join(', ')}`);
            });
        });

        // Multi-centrality hubs
        if (context.topNotes.multiCentralityHubs && context.topNotes.multiCentralityHubs.length > 0) {
            sections.push(`\nMULTI-CENTRALITY HUBS (High in 2+ centralities, Top ${context.topNotes.multiCentralityHubs.length}):`);
            context.topNotes.multiCentralityHubs.forEach(hub => {
                sections.push(`  ${hub.rank}. ${hub.title} (${hub.path})`);
                sections.push(`     Composite Score: ${hub.score.toFixed(4)}, Keywords: ${hub.keywords}, Domains: ${hub.domains.join(', ')}`);
            });
        }
        sections.push('');

        // Interval Summaries
        sections.push('=== CENTRALITY DISTRIBUTION BY INTERVALS ===');
        
        ['betweenness', 'closeness', 'eigenvector'].forEach(centralityType => {
            const summaries = context.intervalSummaries[centralityType as keyof typeof context.intervalSummaries] as IntervalSummary[];
            if (summaries.length === 0) return;

            sections.push(`\n${centralityType.toUpperCase()} Centrality Distribution:`);
            summaries.forEach(summary => {
                sections.push(`  Range ${summary.range}: ${summary.noteCount} notes`);
                if (summary.topKeywords.length > 0) {
                    sections.push(`    Top Keywords: ${summary.topKeywords.join(', ')}`);
                }
                if (summary.topDomains.length > 0) {
                    sections.push(`    Top Domains: ${summary.topDomains.join(', ')}`);
                }
                if (summary.representativeNote) {
                    sections.push(`    Representative Note: ${summary.representativeNote}`);
                }
            });
        });
        sections.push('');

        // Domain Distribution
        sections.push('=== KNOWLEDGE DOMAIN DISTRIBUTION ===');
        sections.push(`Total Domains: ${context.domainDistribution.length}`);
        sections.push('\nTop Domains by Note Count:');
        context.domainDistribution.slice(0, 20).forEach((domain, index) => {
            sections.push(`  ${index + 1}. ${domain.domain} (${domain.noteCount} notes)`);
            sections.push(`     Avg Betweenness: ${domain.avgBetweenness.toFixed(4)}, Avg Closeness: ${domain.avgCloseness.toFixed(4)}, Avg Eigenvector: ${domain.avgEigenvector.toFixed(4)}`);
        });
        if (context.domainDistribution.length > 20) {
            sections.push(`  ... and ${context.domainDistribution.length - 20} more domains`);
        }

        return sections.join('\n');
    }
}
