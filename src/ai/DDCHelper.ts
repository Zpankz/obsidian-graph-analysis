// DDC Helper module for all DDC-related logic and types
// Extracted from MasterAnalysisManager.ts

import { App } from 'obsidian';

// DDC Template interfaces - UPDATED for new structured ID system
export interface DDCSection {
    id: string;
    name: string;
}

export interface DDCDivision {
    id: string;
    name: string;
    sections: DDCSection[];
}

export interface DDCClass {
    id: string;
    name: string;
    divisions: DDCDivision[];
}

export interface DDCTemplate {
    ddc_23_summaries: {
        title: string;
        classes: DDCClass[];
    };
}

export type DDCSectionListItem = { id: string; name: string; division: string; mainClass: string };

export class DDCHelper {
    private static instance: DDCHelper | null = null;
    private ddcTemplate: DDCTemplate | null = null;
    private ddcMainClasses: { [key: string]: string } = {};
    private ddcDivisions: { [key: string]: string } = {};
    private ddcSections: { [key: string]: string } = {};
    private ddcSectionsList: DDCSectionListItem[] = [];
    private app: App;

    private constructor(app: App) {
        this.app = app;
    }

    public static getInstance(app: App): DDCHelper {
        if (!DDCHelper.instance) {
            DDCHelper.instance = new DDCHelper(app);
        }
        return DDCHelper.instance;
    }

    public getAllDDCSections(): DDCSectionListItem[] {
        return this.ddcSectionsList;
    }

    public async loadDDCTemplate(): Promise<void> {
        if (this.ddcTemplate) return;
        try {
            const templatePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/DDC-template.json`;
            let ddcContent: string | null = null;
            try {
                ddcContent = await this.app.vault.adapter.read(templatePath);
            } catch (pathError) {
                throw new Error('DDC template not found in the plugin directory. Please ensure the DDC-template.json file is properly copied to the plugin directory during installation.');
            }
            try {
                this.ddcTemplate = JSON.parse(ddcContent);
            } catch (parseError) {
                throw new Error(`Failed to parse DDC template JSON: ${parseError.message}`);
            }
            this.ddcMainClasses = {};
            this.ddcDivisions = {};
            this.ddcSections = {};
            this.ddcSectionsList = [];
            if (this.ddcTemplate?.ddc_23_summaries?.classes) {
                this.ddcTemplate.ddc_23_summaries.classes.forEach(ddcClass => {
                    this.ddcMainClasses[ddcClass.id] = ddcClass.name;
                    ddcClass.divisions.forEach(division => {
                        this.ddcDivisions[division.id] = division.name;
                        division.sections.forEach(section => {
                            this.ddcSections[section.id] = section.name;
                            this.ddcSectionsList.push({
                                id: section.id,
                                name: section.name,
                                division: division.name,
                                mainClass: ddcClass.name
                            });
                        });
                    });
                });
            } else {
                throw new Error('DDC template has invalid structure. Expected ddc_23_summaries.classes array.');
            }
        } catch (error) {
            this.ddcTemplate = null;
            this.ddcMainClasses = {};
            this.ddcDivisions = {};
            this.ddcSections = {};
            this.ddcSectionsList = [];
            throw error;
        }
    }

    public async ensureDDCTemplateLoaded(): Promise<boolean> {
        try {
            await this.loadDDCTemplate();
            return true;
        } catch (error) {
            console.error('Failed to load DDC template:', error);
            return false;
        }
    }

    public getDDCTemplate(): DDCTemplate | null {
        return this.ddcTemplate;
    }

    public isValidDDCSectionId(sectionId: string): boolean {
        if (this.ddcSections[sectionId]) return true;
        let normalizedId = sectionId;
        if (!sectionId.includes('-')) {
            if (sectionId.length === 3) {
                normalizedId = `${sectionId[0]}-${sectionId[1]}-${sectionId[2]}`;
            } else if (sectionId.length === 1) {
                normalizedId = `0-0-${sectionId}`;
            }
        }
        if (this.ddcSections[normalizedId]) return true;
        const numbers = sectionId.match(/\d+/g);
        if (numbers && numbers.length === 3) {
            const constructed = `${numbers[0]}-${numbers[1]}-${numbers[2]}`;
            if (this.ddcSections[constructed]) return true;
        }
        return false;
    }

    public getDDCSectionInfo(sectionId: string): DDCSectionListItem | null {
        return this.ddcSectionsList.find(section => section.id === sectionId) || null;
    }

    public getSectionsInDivision(divisionId: string): DDCSectionListItem[] {
        return this.ddcSectionsList.filter(section => this.getDivisionIdFromSection(section.id) === divisionId);
    }

    public getSectionsInClass(classId: string): DDCSectionListItem[] {
        return this.ddcSectionsList.filter(section => this.getClassIdFromSection(section.id) === classId);
    }

    public getDDCCodeToNameMap(): Map<string, string> {
        const map = new Map<string, string>();
        this.ddcSectionsList.forEach(section => {
            map.set(section.id, section.name);
        });
        if (this.ddcTemplate && this.ddcTemplate.ddc_23_summaries && this.ddcTemplate.ddc_23_summaries.classes) {
            this.ddcTemplate.ddc_23_summaries.classes.forEach(cls => {
                map.set(cls.id, cls.name);
            });
        }
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

    public getClassIdFromSection(sectionId: string): string {
        return sectionId.split('-')[0];
    }

    public getDivisionIdFromSection(sectionId: string): string {
        const parts = sectionId.split('-');
        return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : sectionId;
    }
}
