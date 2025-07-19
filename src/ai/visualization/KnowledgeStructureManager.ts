import { App, setIcon } from 'obsidian';
import { GraphAnalysisSettings, HierarchicalDomain, DomainConnection } from '../../types/types';
import { 
    DomainDistributionChart, 
    DomainDistributionData
} from '../../components/domain-distribution/DomainDistributionChart';
import { MasterAnalysisManager } from '../MasterAnalysisManager';


export interface NetworkNode {
    domain: string;
    domainCode: string;
    explanation: string;
    averageScore: number;
    noteCount: number;
    topNotes: Array<{
        title: string;
        score: number;
        rank: number;
        path: string;
    }>;
    connections?: string[];
    reach?: number;
    influence?: number;
    insights?: string;
}

export interface KnowledgeStructureData {
    // Network analysis
    knowledgeNetwork: {
        bridges: NetworkNode[];
        foundations: NetworkNode[];
        authorities: NetworkNode[];
    };
    
    // Knowledge gaps
    gaps: string[];
}

export class KnowledgeStructureManager {
    private app: App;
    private settings: GraphAnalysisSettings;
    private container: HTMLElement;
    private data: KnowledgeStructureData | null = null;
    private domainHierarchy: HierarchicalDomain[] | null = null;
    private domainConnections: DomainConnection[] | null = null;
    private createEmptyStateFn: (container: HTMLElement, message: string) => void;

    constructor(app: App, settings: GraphAnalysisSettings, createEmptyStateFn?: (container: HTMLElement, message: string) => void) {
        this.app = app;
        this.settings = settings;
        this.createEmptyStateFn = createEmptyStateFn || this.defaultCreateEmptyState.bind(this);
    }

    /**
     * Default empty state implementation for when no callback is provided
     */
    private defaultCreateEmptyState(container: HTMLElement, message: string): void {
        const emptyState = document.createElement('div');
        emptyState.className = 'network-empty-state';
        emptyState.style.textAlign = 'center';
        emptyState.style.padding = '40px 20px';
        emptyState.style.background = 'var(--background-secondary-alt)';
        emptyState.style.borderRadius = '12px';
        emptyState.style.border = '1px dashed var(--background-modifier-border)';
        container.appendChild(emptyState);
        
        const iconEl = document.createElement('div');
        iconEl.className = 'network-empty-state-icon';
        iconEl.style.marginBottom = '16px';
        iconEl.style.display = 'flex';
        iconEl.style.justifyContent = 'center';
        iconEl.style.alignItems = 'center';
        emptyState.appendChild(iconEl);
        
        // Add Lucide chart icon
        setIcon(iconEl, 'bar-chart-2');
        
        const textEl = document.createElement('p');
        textEl.className = 'network-empty-state-text';
        textEl.textContent = message;
        textEl.style.color = 'var(--text-muted)';
        textEl.style.fontSize = '14px';
        textEl.style.lineHeight = '1.5';
        emptyState.appendChild(textEl);
    }

    public async loadCachedStructureData(): Promise<KnowledgeStructureData | null> {
        try {
            const filePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/responses/structure-analysis.json`;
            const content = await this.app.vault.adapter.read(filePath);
            const data = JSON.parse(content);
            
            if (data?.knowledgeStructure) {
                this.data = data.knowledgeStructure;
                return this.data;
            }
            return null;
        } catch (error) {
            console.warn('No cached knowledge structure data found:', error);
            return null;
        }
    }

    public async renderStructureAnalysis(container: HTMLElement): Promise<void> {
        this.container = container;
        this.container.empty();

        // Load data if not already loaded
        if (!this.data) {
            await this.loadCachedStructureData();
        }

        // Load domain hierarchy if not already loaded
        if (!this.domainHierarchy || this.domainHierarchy.length === 0) {
            try {
                // Load domain hierarchy from vault-analysis.json
                const filePath = `${this.app.vault.configDir}/plugins/obsidian-graph-analysis/vault-analysis.json`;
                const content = await this.app.vault.adapter.read(filePath);
                const vaultAnalysisData = JSON.parse(content);
                
                if (vaultAnalysisData && vaultAnalysisData.results) {
                    // Create a new MasterAnalysisManager instance
                    const masterAnalysisManager = new MasterAnalysisManager(this.app, this.settings);
                    
                    // Ensure DDC template is loaded
                    await masterAnalysisManager.ensureDDCTemplateLoaded();
                    
                    // Build hierarchy
                    this.domainHierarchy = masterAnalysisManager.buildHierarchyFromVaultData(vaultAnalysisData);
                }
            } catch (error) {
                console.error('Failed to load domain hierarchy:', error);
            }
        }

        // Always create the three main sections - they will handle their own empty states
        await this.createKnowledgeDomainDistributionSection();
        await this.createKnowledgeNetworkAnalysisSection();
        await this.createKnowledgeGapSection();
    }

    private renderPlaceholder(): void {
        // Create main container
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'structure-placeholder';
        this.container.appendChild(placeholderDiv);
        
        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'placeholder-content';
        placeholderDiv.appendChild(contentDiv);
        
        // Create header with icon
        const header = document.createElement('h3');
        contentDiv.appendChild(header);
        
        const headerIcon = document.createElement('span');
        headerIcon.style.display = 'inline-flex';
        headerIcon.style.alignItems = 'center';
        headerIcon.style.marginRight = '8px';
        headerIcon.style.verticalAlign = 'middle';
        header.appendChild(headerIcon);
        setIcon(headerIcon, 'layout-panel-top');
        
        header.appendChild(document.createTextNode('Knowledge Structure Analysis'));
        
        // Create description
        const description = document.createElement('p');
        description.textContent = 'Generate vault analysis to see your knowledge structure insights.';
        contentDiv.appendChild(description);
        
        // Create features container
        const featuresDiv = document.createElement('div');
        featuresDiv.className = 'placeholder-features';
        contentDiv.appendChild(featuresDiv);
        
        // Create feature items
        const features = [
            { icon: 'target', text: 'Domain Distribution' },
            { icon: 'network', text: 'Knowledge Network' },
            { icon: 'search', text: 'Knowledge Gaps' }
        ];
        
        features.forEach(feature => {
            const featureItem = document.createElement('div');
            featureItem.className = 'feature-item';
            featuresDiv.appendChild(featureItem);
            
            const iconSpan = document.createElement('span');
            iconSpan.className = 'feature-icon';
            featureItem.appendChild(iconSpan);
            setIcon(iconSpan, feature.icon);
            
            const textSpan = document.createElement('span');
            textSpan.textContent = feature.text;
            featureItem.appendChild(textSpan);
        });
    }

    /**
     * Section 1: Knowledge Domain Distribution
     */
    private async createKnowledgeDomainDistributionSection(): Promise<void> {
        const section = this.container.createEl('div', { 
            cls: 'vault-analysis-section' 
        });

        section.createEl('h3', {
            text: 'Knowledge Domain Distribution',
            cls: 'vault-analysis-section-title'
        });

        // Check if we have hierarchical data
        if (!this.domainHierarchy || this.domainHierarchy.length === 0) {
            this.createEmptyStateFn(section, 'Generate vault analysis to see your knowledge domain distribution.');
            return;
        }

        // Create chart container with proper sizing
        const chartContainer = section.createEl('div', { 
            cls: 'domain-chart-container'
        });
        
        // Prepare data for the domain distribution component
        const domainDistributionData: DomainDistributionData = {
            domainHierarchy: this.domainHierarchy,
            domainConnections: this.domainConnections || []
        };
        
        // Create and render the domain distribution chart
        const domainChart = new DomainDistributionChart(
            this.app,
            this.settings,
            chartContainer,
            {
                chartType: 'sunburst',
                showTooltips: true,
                showLabels: true
            }
        );
        
        await domainChart.renderWithData(domainDistributionData);
    }

    /**
     * Section 2: Knowledge Network Analysis
     */
    private async createKnowledgeNetworkAnalysisSection(customContainer?: HTMLElement): Promise<void> {
        const targetContainer = customContainer || this.container;
        
        const section = targetContainer.createEl('div', { 
            cls: 'vault-analysis-section' 
        });

        section.createEl('h3', {
            text: 'Knowledge Network Analysis',
            cls: 'vault-analysis-section-title'
        });

        const networkData = this.data?.knowledgeNetwork;

        // Check if we have any network data
        if (!networkData || (!networkData.bridges?.length && !networkData.foundations?.length && !networkData.authorities?.length)) {
            this.createEmptyStateFn(section, 'Generate AI analysis to identify knowledge bridges, foundations, and authorities in your vault\'s network structure.');
            return;
        }

        // Create card layout for network analysis
        this.renderNetworkCards(section, networkData);
    }

    /**
     * Render network analysis in card-based layout
     */
    private renderNetworkCards(section: HTMLElement, networkData: any): void {
        // Create card container for vertical layout
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'knowledge-network-cards-container network-cards-container';
        cardsContainer.style.display = 'flex';
        cardsContainer.style.flexDirection = 'column';
        cardsContainer.style.gap = '20px';
        cardsContainer.style.marginBottom = '30px';
        cardsContainer.style.width = '100%';
        cardsContainer.style.padding = '20px 0';
        cardsContainer.style.boxSizing = 'border-box';
        section.appendChild(cardsContainer);

        // Create cards for each category
        if (networkData.bridges && networkData.bridges.length > 0) {
            this.createNetworkCard(cardsContainer, 'bridges', 'Knowledge Bridges', 
                'Domains that connect different areas of knowledge', networkData.bridges);
        }

        if (networkData.foundations && networkData.foundations.length > 0) {
            this.createNetworkCard(cardsContainer, 'foundations', 'Knowledge Foundations', 
                'Core domains that serve as central access points', networkData.foundations);
        }

        if (networkData.authorities && networkData.authorities.length > 0) {
            this.createNetworkCard(cardsContainer, 'authorities', 'Knowledge Authorities', 
                'Influential domains with high connectivity', networkData.authorities);
        }
    }

    /**
     * Create a card for a specific network category
     */
    private createNetworkCard(parent: HTMLElement, type: string, title: string, description: string, nodes: NetworkNode[]): void {
        // Create card container
        const card = document.createElement('div');
        card.className = 'network-card';
        card.style.width = '100%';
        card.style.background = 'var(--background-primary)';
        card.style.borderRadius = '12px';
        card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        card.style.padding = '0';
        card.style.overflow = 'hidden';
        card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        card.style.border = '1px solid var(--background-modifier-border)';
        card.style.margin = '0';
        card.style.position = 'relative';
        card.style.zIndex = '1';
        card.style.boxSizing = 'border-box';
        parent.appendChild(card);
        
        // Card header
        const header = document.createElement('div');
        header.className = 'network-card-header';
        header.style.padding = '16px 20px';
        header.style.background = 'var(--background-secondary)';
        header.style.borderBottom = '1px solid var(--background-modifier-border)';
        header.style.display = 'flex';
        header.style.alignItems = 'flex-start';
        header.style.gap = '12px';
        card.appendChild(header);
        
        // Lucide icon
        const iconEl = document.createElement('div');
        iconEl.className = 'network-card-icon';
        iconEl.style.display = 'flex';
        iconEl.style.alignItems = 'center';
        iconEl.style.justifyContent = 'center';
        iconEl.style.width = '24px';
        iconEl.style.height = '24px';
        iconEl.style.color = 'var(--text-accent)';
        iconEl.style.flexShrink = '0';
        header.appendChild(iconEl);
        
        // Set Lucide icon based on type
        if (type === 'bridges') {
            setIcon(iconEl, 'route');
        } else if (type === 'foundations') {
            setIcon(iconEl, 'star');
        } else if (type === 'authorities') {
            setIcon(iconEl, 'orbit');
        }
        
        // Title container
        const titleContainer = document.createElement('div');
        titleContainer.className = 'network-card-title-container';
        titleContainer.style.flex = '1';
        header.appendChild(titleContainer);
        
        const titleEl = document.createElement('h4');
        titleEl.className = 'network-card-title';
        titleEl.textContent = title;
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = '600';
        titleEl.style.color = 'var(--text-normal)';
        titleEl.style.margin = '0';
        titleEl.style.lineHeight = '1.3';
        titleContainer.appendChild(titleEl);
        
        // Count and description in the header
        const metaContainer = document.createElement('div');
        metaContainer.style.display = 'flex';
        metaContainer.style.flexDirection = 'column';
        metaContainer.style.gap = '4px';
        titleContainer.appendChild(metaContainer);
        
        const countEl = document.createElement('span');
        countEl.className = 'network-card-count';
        countEl.textContent = `${nodes.length} domain${nodes.length !== 1 ? 's' : ''}`;
        countEl.style.fontSize = '14px';
        countEl.style.color = 'var(--text-muted)';
        countEl.style.fontWeight = '500';
        metaContainer.appendChild(countEl);
        
        // Description in header
        const descEl = document.createElement('span');
        descEl.className = 'network-card-description';
        descEl.textContent = description;
        descEl.style.fontSize = '13px';
        descEl.style.color = 'var(--text-muted)';
        descEl.style.fontStyle = 'italic';
        metaContainer.appendChild(descEl);

        // Content container
        const content = document.createElement('div');
        content.className = 'network-card-content';
        content.style.padding = '0';
        card.appendChild(content);

        // Show top domains (take top 3)
        nodes.slice(0, 3).forEach((node, index) => {
            const domainItem = document.createElement('div');
            domainItem.className = 'network-domain-item';
            domainItem.style.padding = '20px';
            // Use alternating background colors for visual separation
            if (index % 2 === 1) {
                domainItem.style.background = 'var(--background-secondary-alt)';
            }
            // Add margin between items instead of border
            if (index > 0) {
                domainItem.style.marginTop = '4px';
            }
            content.appendChild(domainItem);
            
            // Domain header
            const domainHeader = document.createElement('div');
            domainHeader.className = 'network-domain-header';
            domainHeader.style.display = 'flex';
            domainHeader.style.justifyContent = 'space-between';
            domainHeader.style.alignItems = 'center';
            domainHeader.style.marginBottom = '12px';
            domainItem.appendChild(domainHeader);
            
            const domainName = document.createElement('strong');
            domainName.className = 'network-domain-name';
            domainName.textContent = node.domain;
            domainName.style.fontSize = '16px';
            domainName.style.fontWeight = '600';
            domainName.style.color = 'var(--text-accent)';
            domainHeader.appendChild(domainName);
            
            const domainStats = document.createElement('span');
            domainStats.className = 'network-domain-stats';
            domainStats.textContent = `${node.averageScore.toFixed(3)} • ${node.noteCount} notes`;
            domainStats.style.fontSize = '12px';
            domainStats.style.color = 'var(--text-muted)';
            domainStats.style.fontWeight = '500';
            domainStats.style.padding = '4px 8px';
            domainStats.style.background = 'var(--background-secondary)';
            domainStats.style.borderRadius = '12px';
            domainHeader.appendChild(domainStats);

            // Domain explanation
            const explanation = document.createElement('p');
            explanation.className = 'network-domain-explanation';
            explanation.textContent = node.explanation;
            explanation.style.fontSize = '14px';
            explanation.style.color = 'var(--text-normal)';
            explanation.style.marginBottom = '14px';
            explanation.style.lineHeight = '1.6';
            domainItem.appendChild(explanation);

            // Top notes
            if (node.topNotes && node.topNotes.length > 0) {
                const notesHeader = document.createElement('div');
                notesHeader.className = 'network-notes-header';
                notesHeader.style.fontSize = '14px';
                notesHeader.style.fontWeight = '600';
                notesHeader.style.color = 'var(--text-muted)';
                notesHeader.style.marginBottom = '10px';
                notesHeader.style.display = 'flex';
                notesHeader.style.alignItems = 'center';
                notesHeader.style.gap = '6px';
                domainItem.appendChild(notesHeader);
                
                // Add a small Lucide icon for the notes section
                const notesIcon = document.createElement('span');
                notesIcon.style.display = 'inline-flex';
                notesIcon.style.alignItems = 'center';
                notesHeader.appendChild(notesIcon);
                
                setIcon(notesIcon, 'file');
                
                const notesText = document.createElement('span');
                notesText.textContent = 'Top Notes';
                notesHeader.appendChild(notesText);
                
                const notesList = document.createElement('ul');
                notesList.className = 'network-notes-list';
                notesList.style.listStyle = 'none';
                notesList.style.padding = '12px 16px';
                notesList.style.margin = '0';
                notesList.style.background = 'var(--background-primary)';
                notesList.style.borderRadius = '8px';
                notesList.style.border = '1px solid var(--background-modifier-border)';
                domainItem.appendChild(notesList);
                
                node.topNotes.slice(0, 3).forEach((note, noteIndex) => {
                    const noteItem = document.createElement('li');
                    noteItem.className = 'network-note-item';
                    noteItem.style.fontSize = '13px';
                    noteItem.style.padding = '6px 0';
                    // Add subtle separators between notes
                    if (noteIndex > 0) {
                        noteItem.style.borderTop = '1px dashed var(--background-modifier-border)';
                    }
                    noteItem.style.color = 'var(--text-normal)';
                    noteItem.style.display = 'flex';
                    noteItem.style.alignItems = 'center';
                    noteItem.style.justifyContent = 'space-between';
                    notesList.appendChild(noteItem);
                    
                    const noteLink = document.createElement('span');
                    noteLink.className = 'network-note-link';
                    noteLink.textContent = note.title;
                    noteLink.style.color = 'var(--text-accent)';
                    noteLink.style.textDecoration = 'none';
                    noteLink.style.cursor = 'pointer';
                    noteLink.style.flex = '1';
                    noteLink.style.whiteSpace = 'nowrap';
                    noteLink.style.overflow = 'hidden';
                    noteLink.style.textOverflow = 'ellipsis';
                    noteItem.appendChild(noteLink);

                    const noteScore = document.createElement('span');
                    noteScore.className = 'network-note-score';
                    noteScore.textContent = note.score.toFixed(3);
                    noteScore.style.color = 'var(--text-muted)';
                    noteScore.style.fontWeight = '500';
                    noteScore.style.marginLeft = '8px';
                    noteItem.appendChild(noteScore);

                    // Make note clickable
                    noteLink.addEventListener('click', async () => {
                        const file = this.app.vault.getAbstractFileByPath(note.path);
                        if (file) {
                            await this.app.workspace.openLinkText(note.path, '');
                        }
                    });
                });
            }
        });
    }



    /**
     * Section 3: Knowledge Gap Analysis
     */
    private async createKnowledgeGapSection(): Promise<void> {
        const section = this.container.createEl('div', { 
            cls: 'vault-analysis-section' 
        });

        section.createEl('h3', {
            text: 'Knowledge Gap Analysis',
            cls: 'vault-analysis-section-title'
        });

        if (this.data?.gaps && this.data.gaps.length > 0) {
            const gapsContainer = section.createEl('div', { 
                cls: 'ai-insights-container'
            });

            gapsContainer.createEl('h4', {
                text: '🎯 Identified Knowledge Gaps',
                cls: 'ai-insights-title'
            });

            const gapsList = gapsContainer.createEl('ul', { 
                cls: 'gaps-list' 
            });

            this.data.gaps.slice(0, 8).forEach(gap => {
                gapsList.createEl('li', { text: gap });
            });
        } else {
            this.createEmptyStateFn(section, 'Generate AI analysis to identify potential knowledge gaps and areas for expansion in your vault.');
        }
    }

    public updateSettings(settings: GraphAnalysisSettings): void {
        this.settings = settings;
    }

    public setData(data: KnowledgeStructureData): void {
        this.data = data;
    }

    public setDomainHierarchy(hierarchy: HierarchicalDomain[]): void {
        this.domainHierarchy = hierarchy;
    }

    public setDomainConnections(connections: DomainConnection[]): void {
        this.domainConnections = connections;
    }

    public async renderWithData(container: HTMLElement, data: KnowledgeStructureData, domainHierarchy?: HierarchicalDomain[]): Promise<void> {
        this.data = data;
        if (domainHierarchy) {
            this.domainHierarchy = domainHierarchy;
        }
        await this.renderStructureAnalysis(container);
    }

    /**
     * Public method to render just the network analysis section
     */
    public async renderNetworkAnalysis(container: HTMLElement, data?: KnowledgeStructureData): Promise<void> {
        // Set data if provided
        if (data) {
            this.data = data;
        }
        
        // Load data if not already available
        if (!this.data) {
            await this.loadCachedStructureData();
        }

        // Clear container and render network analysis
        container.empty();
        
        if (!this.data) {
            this.createEmptyStateFn(container, 'Generate AI analysis to identify knowledge bridges, foundations, and authorities in your vault\'s network structure.');
            return;
        }

        await this.createKnowledgeNetworkAnalysisSection(container);
    }
}