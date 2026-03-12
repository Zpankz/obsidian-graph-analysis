# How the Bridge, Foundation, and Authority Section Is Shown

This document describes how the **Knowledge Bridges**, **Knowledge Foundations**, and **Knowledge Authorities** section is displayed in the Knowledge Structure tab, based on the code in `KnowledgeStructureManager.ts` and `VaultAnalysisModals.ts` (main branch).

---

## 1. Entry Point: VaultAnalysisModals

When the user opens the **Knowledge Structure** tab, `loadKnowledgeStructureView()` runs.

### Prerequisites

- `hasExistingData` must be true (vault analysis has been run)
- `analysisData` must exist (vault-analysis.json loaded)
- Cached structure analysis is loaded from `structure-analysis.json` via `loadCachedTabAnalysis('structure', ...)`

### Branch Logic

```
if (structureAnalysisData?.knowledgeStructure) {
    // Path A: We have cached structure data
    displayNetworkAnalysis(networkAnalysisSection)
    displayKnowledgeGaps(gapsSection)
    createUpdateAnalysisButtonSection(...)
} else {
    // Path B: No cached structure data
    showNetworkAnalysisPlaceholder(...)
    showKnowledgeGapsPlaceholder(...)
    createAnalysisButtonSection(...)  // "Generate analysis" button
}
```

---

## 2. displayNetworkAnalysis (VaultAnalysisModals)

Before calling `KnowledgeStructureManager`, it checks:

```typescript
if (!this.structureAnalysisData?.knowledgeStructure?.knowledgeNetwork) {
    this.showNetworkAnalysisPlaceholder(container);
    return;
}
```

So the Bridge/Foundation/Authority section is only rendered when:

1. `structureAnalysisData` exists
2. `structureAnalysisData.knowledgeStructure` exists
3. `structureAnalysisData.knowledgeStructure.knowledgeNetwork` exists (truthy)

If any of these is missing, the placeholder is shown instead and the section is not rendered.

---

## 3. renderNetworkAnalysis (KnowledgeStructureManager)

Called with `container` = `networkAnalysisSection` (which already has the KDE chart) and `data` = `structureAnalysisData.knowledgeStructure`.

1. Sets `this.data = data`
2. If `this.data` is null, shows empty state and returns
3. Calls `createKnowledgeNetworkAnalysisSection(container)`

---

## 4. createKnowledgeNetworkAnalysisSection (KnowledgeStructureManager)

### Step 1: Determine target section

- If `container` already has `.kde-chart-container` → `section = container`
- Otherwise → creates a new section, renders KDE chart into it

### Step 2: Check for network data

```typescript
const networkData = this.data?.knowledgeNetwork;

if (!networkData || (!networkData.bridges?.length && !networkData.foundations?.length && !networkData.authorities?.length)) {
    if (!hasKDEChart) {
        this.createEmptyStateFn(section, 'Generate AI analysis to identify knowledge bridges...');
    }
    return;  // ← Early exit: no Bridge/Foundation/Authority section is rendered
}
```

### Step 3: Render the tabs

If all arrays are empty, the function returns early and **never calls** `renderNetworkCards`. So the Bridge/Foundation/Authority section is only shown when at least one of `bridges`, `foundations`, or `authorities` has at least one item.

---

## 5. renderNetworkCards (KnowledgeStructureManager)

Builds the tabbed UI when the data check passes.

### Structure

1. **Tab bar** (`.knowledge-network-tab-bar`)

   - `Knowledge Bridges` (icon: `route`)
   - `Knowledge Foundations` (icon: `star`)
   - `Knowledge Authorities` (icon: `orbit`)

2. **Tab content** (`.knowledge-network-tab-content`)

   - One panel per tab

3. **Per-tab content**

   - If `tab.data.length > 0`: domain cards via `createDomainCard()`
   - If `tab.data.length === 0`: empty state with message like `"No knowledge bridges found."`

### Active tab

- First tab with data is active by default
- If all tabs are empty, active tab is `tabs[0]` (bridges)

---

## 6. Summary: When the Bridge/Foundation/Authority Section Appears

| Condition | Result |
|-----------|--------|
| No `structureAnalysisData` | Placeholder shown; no section |
| No `knowledgeStructure` | Placeholder shown; no section |
| No `knowledgeNetwork` | Placeholder shown; no section |
| `knowledgeNetwork` exists but `bridges`, `foundations`, and `authorities` are all empty | **Section is not shown** (early return in `createKnowledgeNetworkAnalysisSection`) |
| At least one of `bridges`, `foundations`, or `authorities` has at least one item | **Section is shown** via `renderNetworkCards` |

---

## 7. Data Flow

```
structure-analysis.json
    └── knowledgeStructure: KnowledgeStructureData
            ├── knowledgeNetwork: { bridges, foundations, authorities }
            └── gaps: string[]

VaultAnalysisModals.displayNetworkAnalysis()
    → checks knowledgeStructure.knowledgeNetwork
    → KnowledgeStructureManager.renderNetworkAnalysis(container, knowledgeStructure)

KnowledgeStructureManager.createKnowledgeNetworkAnalysisSection()
    → checks networkData.bridges?.length || foundations?.length || authorities?.length
    → if any non-empty: renderNetworkCards(section, networkData)
```

---

## 8. Per-card content (createDomainCard / addNodeSections)

For each domain node:

| Section | Content | When shown |
|---------|---------|------------|
| Domain name | `node.domain` | Always |
| Explanation | `node.explanation` | Always |
| Top notes | `node.topNotes` (clickable links) | If `topNotes.length > 0` |
| Connections | `node.connections` | Bridges only |
| Coverage | `node.coverage` | Foundations only |
| Influence | `node.influence` | Authorities only |
| Insights | `node.insights` | If present |
