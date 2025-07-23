import { Type } from '@google/genai';

export interface KnowledgeNetworkNode {
    title: string;
    path: string;
    rank: number;
}

export interface KnowledgeBridge {
    domain: string;
    explanation: string;
    topNotes: KnowledgeNetworkNode[];
    connections: string[];
    insights: string;
}

export interface KnowledgeFoundation {
    domain: string;
    explanation: string;
    topNotes: KnowledgeNetworkNode[];
    coverage: string[];
    insights: string;
}

export interface KnowledgeAuthority {
    domain: string;
    explanation: string;
    topNotes: KnowledgeNetworkNode[];
    influence: string[];
    insights: string;
}

export interface KnowledgeNetwork {
    bridges: KnowledgeBridge[];
    foundations: KnowledgeFoundation[];
    authorities: KnowledgeAuthority[];
}

export interface KnowledgeNetworkAnalysis {
    knowledgeNetwork: KnowledgeNetwork;
    knowledgeGaps: string[];
}

/**
 * Schema for knowledge network analysis using Google Gemini structured output
 */
export function createKnowledgeNetworkSchema(): any {
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