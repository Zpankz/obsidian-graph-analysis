import { Type } from '@google/genai';

/**
 * Interface for a single DDC section classification
 */
export interface DDCSection {
    id: string;          // "0-0-4"
    name: string;        // "Computer science"
}

/**
 * Interface for domain classification result 
 * Stores section-level DDC codes and names for hierarchy building
 */
export interface DomainClassificationResult {
    primaryDomain: DDCSection;
    secondaryDomains: DDCSection[];
}

/**
 * Enhanced interface for notes with structured domain classification
 * Replaces the current string-based knowledgeDomain approach
 */
export interface ClassifiedNote {
    summary: string;
    keywords: string;
    domains: DomainClassificationResult;
}

/**
 * Schema for domain classification using Google Gemini structured output
 * This constrains AI responses to valid DDC section codes from the template
 * 
 * @param availableDDCSections - Array of valid DDC sections from the loaded template
 * @returns Schema that ensures only valid DDC section codes are returned
 */
export function createDomainClassificationSchema(availableDDCSections: DDCSection[]): any {
    // Extract valid DDC section IDs for enum constraint
    const validSectionIds = availableDDCSections.map(section => section.id);
    
    return {
        type: Type.OBJECT,
        properties: {
            primaryDomain: {
                type: Type.OBJECT,
                properties: {
                    id: {
                        type: Type.STRING,
                        enum: validSectionIds,
                        description: "Primary DDC section code (e.g., '0-0-4')"
                    },
                    name: {
                        type: Type.STRING,
                        description: "DDC section name (e.g., 'Computer science')"
                    }
                },
                required: ["id", "name"],
                propertyOrdering: ["id", "name"]
            },
            secondaryDomains: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: {
                            type: Type.STRING,
                            enum: validSectionIds,
                            description: "Secondary DDC section code"
                        },
                        name: {
                            type: Type.STRING,
                            description: "DDC section name"
                        }
                    },
                    required: ["id", "name"],
                    propertyOrdering: ["id", "name"]
                },
                maxItems: 2,
                description: "Up to 2 secondary domain classifications"
            }
        },
        required: ["primaryDomain", "secondaryDomains"],
        propertyOrdering: ["primaryDomain", "secondaryDomains"]
    };
}

 