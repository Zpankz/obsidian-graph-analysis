# Obsidian UI API Refactoring Checklist

This document lists UI elements in the Graph Analysis plugin that should be refactored to align with [Obsidian UI API best practices](https://docs.obsidian.md/Plugins/User+interface) for theme compatibility, consistency, and maintainability.

## Obsidian UI Best Practices (Reference)

- **Use Obsidian's Setting API** (`Setting`, `addText`, `addToggle`, `addDropdown`, `addButton`, `addExtraButton`) for form controls
- **Use CSS variables** (`var(--text-normal)`, `var(--background-primary)`, `var(--radius-m)`, etc.) instead of hardcoded colors and dimensions
- **Use `createEl` / `createDiv`** for custom layouts; avoid inline `.style` assignments—prefer CSS classes
- **Use `FuzzySuggestModal`** for searchable selection lists instead of custom dropdowns
- **Use `setIcon`** with Lucide icon names for icons
- **Use Obsidian button classes** (`mod-cta`, `mod-warning`) for consistent button styling
- **Avoid hardcoded `rgba()` and hex colors**—use theme variables or `var(--*-rgb)` for transparency

---

## 1. Settings Tab (`src/settings/GraphAnalysisSettingTab.ts`)


| Element                                      | Current Implementation                          | Refactor To                                                         | Priority |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Excluded Folders                             | `Setting.addText()`                             | Already uses Setting API                                            | Done     |
| Exclude Tags                                 | `Setting.addText()`                             | Already uses Setting API                                            | Done     |
| Gemini API Key                               | `Setting.addText()` + `addExtraButton()`        | Already uses Setting API                                            | Done     |
| Exclusion stats "Show excluded files" button | Custom `createEl('button', { cls: 'mod-cta' })` | `Setting.addButton()` with `setButtonText()`                        | Medium   |
| Exclusion stats section                      | Custom `createDiv` + manual layout              | Consider `Setting.setCollapsible()` for optional expandable section | Low      |


---

## 2. Modals

### 2.1 ExcludedFilesModal (`src/settings/GraphAnalysisSettingTab.ts`)


| Element           | Current Implementation       | Refactor To                                                                 | Priority |
| ----------------- | ---------------------------- | --------------------------------------------------------------------------- | -------- |
| File list display | Custom `createDiv` per item  | Consider `FuzzySuggestModal` if list is long and searchable; otherwise keep | Low      |
| Empty state       | `createDiv({ text: '...' })` | Add CSS class for empty state styling                                       | Low      |


### 2.2 AISummaryModal (`src/ai/AISummaryManager.ts`)


| Element           | Current Implementation                          | Refactor To                                                           | Priority |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------- | -------- |
| Title             | `createEl('h2', { cls: 'modal-title' })`        | Use Obsidian modal structure; verify `modal-title` exists in Obsidian | Low      |
| Buttons           | Custom `createEl('button')` with `mod-cta`      | Consider `Setting.addButton()` in a container for consistency         | Low      |
| Content rendering | Manual `innerHTML` for markdown-like formatting | Consider `MarkdownRenderer.render()` for proper Obsidian markdown     | Medium   |


### 2.3 VaultAnalysisModal (`src/views/VaultAnalysisModals.ts`)


| Element                                | Current Implementation                                              | Refactor To                                                                   | Priority |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| Modal dimensions                       | Inline `modalEl.style.width/height/maxWidth/maxHeight`              | Move to CSS class (e.g. `.vault-analysis-modal`) using `var()` where possible | High     |
| Content layout                         | Inline `contentEl.style.overflow/display/flexDirection/height`      | Move to CSS class                                                             | High     |
| Search input                           | Custom `createEl('input', { type: 'text' })`                        | `Setting.addSearch()` or `addText()` for theme-consistent input               | Medium   |
| Tab buttons                            | Custom `createEl('button')`                                         | Consider Obsidian tab pattern or `setClass()` for consistency                 | Medium   |
| Pagination controls                    | Custom buttons with manual styling                                  | Use `mod-cta` / standard button classes; ensure CSS variables                 | Medium   |
| Result items                           | Custom card layout with inline styles                               | Move inline styles to CSS classes; use CSS variables                          | High     |
| Empty states                           | Inline `style.textAlign`, `style.padding`, `style.background`, etc. | Extract to `.empty-state` CSS class                                           | High     |
| Structure/Evolution/Actions containers | Inline `style.overflow`, `style.height`, `style.paddingRight`       | Move to CSS classes                                                           | Medium   |


### 2.4 VaultAnalysisInfoModal (`src/views/VaultAnalysisModals.ts`)


| Element          | Current Implementation         | Refactor To                                          | Priority |
| ---------------- | ------------------------------ | ---------------------------------------------------- | -------- |
| Button container | `modal-button-container` class | Verify alignment with Obsidian modal button patterns | Low      |


---

## 3. Graph View & Color Settings (`src/components/graph-view/GraphView.ts`)


| Element                     | Current Implementation                       | Refactor To                                                                            | Priority |
| --------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Labels/Arrows toggles       | Custom `toggle-track` + `toggle-handle` divs | `Setting.addToggle()` if moved to settings; or keep custom but ensure CSS uses `var()` | Medium   |
| Gradient type selector      | Custom `<select>`                            | `Setting.addDropdown()` if in a Setting context                                        | Medium   |
| Scale/distribution selector | Custom `<select>`                            | `Setting.addDropdown()`                                                                | Medium   |
| Steps selector              | Custom `<select>`                            | `Setting.addDropdown()` or `addSlider()`                                               | Medium   |
| Reversed toggle             | Custom button                                | `Setting.addToggle()`                                                                  | Medium   |
| Gradient palette picker     | Custom clickable divs                        | Consider `FuzzySuggestModal` for palette selection                                     | Low      |
| Tooltip positioning         | Inline `tooltip.style.left/top` with px      | Keep for dynamic positioning; ensure tooltip container uses CSS variables              | Low      |
| Color settings dropdown     | Custom `createDiv` with `display: none`      | Consider Obsidian `Dropdown` or keep but style with CSS variables                      | Low      |


---

## 4. Visualization Managers

### 4.1 KnowledgeStructureManager (`src/ai/visualization/KnowledgeStructureManager.ts`)


| Element             | Current Implementation                                                 | Refactor To                                                                                  | Priority |
| ------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Empty state         | 20+ inline `style.`* assignments                                       | Extract to `.empty-state` CSS class                                                          | High     |
| KDE chart container | Inline `style.display`, `style.alignItems`, `style.gap`, etc.          | Move to CSS classes                                                                          | High     |
| Insight cards       | Inline `style.background`, `style.borderRadius`, `style.padding`, etc. | Move to CSS classes                                                                          | High     |
| Network cards       | Inline `style.boxShadow`, `style.border`, `style.padding`, etc.        | Move to CSS classes; replace `rgba(0,0,0,0.08)` with `var(--background-modifier-box-shadow)` | High     |
| Tab bar/panels      | Inline `style.display`, `style.width`, etc.                            | Move to CSS classes                                                                          | Medium   |


### 4.2 KnowledgeEvolutionManager (`src/ai/visualization/KnowledgeEvolutionManager.ts`)


| Element     | Current Implementation                                              | Refactor To                         | Priority |
| ----------- | ------------------------------------------------------------------- | ----------------------------------- | -------- |
| Empty state | Inline `style.textAlign`, `style.padding`, `style.background`, etc. | Extract to `.empty-state` CSS class | High     |


### 4.3 KnowledgeActionsManager (`src/ai/visualization/KnowledgeActionsManager.ts`)


| Element     | Current Implementation                                              | Refactor To                         | Priority |
| ----------- | ------------------------------------------------------------------- | ----------------------------------- | -------- |
| Empty state | Inline `style.textAlign`, `style.padding`, `style.background`, etc. | Extract to `.empty-state` CSS class | High     |


---

## 5. Chart Components

### 5.1 CentralityKDEChart (`src/components/kde-chart/CentralityKDEChart.ts`)


| Element             | Current Implementation                                   | Refactor To                                                          | Priority |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| No-data message     | Inline `style.textAlign`, `style.color`, `style.padding` | CSS class                                                            | Medium   |
| Tooltip             | Inline styles for background, border, padding, etc.      | CSS class; already uses `var(--background-primary)` etc.—consolidate | Medium   |
| Tooltip positioning | `style.left/top` with px                                 | Keep for dynamic positioning                                         | N/A      |


### 5.2 ConnectivityScatterChart (`src/components/scatter-chart/ConnectivityScatterChart.ts`)


| Element | Current Implementation | Refactor To   | Priority |
| ------- | ---------------------- | ------------- | -------- |
| Tooltip | Similar to KDE chart   | Same as above | Medium   |


### 5.3 KnowledgeCalendarChart (`src/components/calendar-chart/KnowledgeCalendarChart.ts`)


| Element             | Current Implementation   | Refactor To                  | Priority |
| ------------------- | ------------------------ | ---------------------------- | -------- |
| Tooltip positioning | `style.left/top` with px | Keep for dynamic positioning | N/A      |


### 5.4 ConnectionSubgraph (`src/components/connection-subgraph/ConnectionSubGraph.ts`)


| Element             | Current Implementation                                 | Refactor To                                              | Priority |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------- | -------- |
| SVG wrapper         | Inline `style.width`, `style.height`, `style.position` | CSS class                                                | Low      |
| Tooltip positioning | `style.left/top` with px                               | Keep for dynamic positioning                             | N/A      |
| D3 font sizes       | Hardcoded `'11px'`, `'10px'`                           | Consider `var(--font-ui-small)` or similar if applicable | Low      |


### 5.5 DomainDistributionChart (`src/components/domain-distribution/DomainDistributionChart.ts`)


| Element       | Current Implementation         | Refactor To                              | Priority |
| ------------- | ------------------------------ | ---------------------------------------- | -------- |
| D3 font sizes | Hardcoded `10px`, `14px`, etc. | Consider CSS variables for theme scaling | Low      |


---

## 6. VaultSemanticAnalysisManager (`src/ai/VaultSemanticAnalysisManager.ts`)


| Element                 | Current Implementation                                                    | Refactor To                              | Priority |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------- | -------- |
| Notice "Enhance" button | Inline `style.marginLeft`, `style.padding`, `style.backgroundColor`, etc. | Use Obsidian button classes or CSS class | Medium   |


---

## 7. CentralityResultsView (`src/views/CentralityResultsView.ts`)


| Element                | Current Implementation                                                        | Refactor To | Priority |
| ---------------------- | ----------------------------------------------------------------------------- | ----------- | -------- |
| Pagination number span | Inline `style.minWidth`, `style.marginRight`, `style.color`, `style.fontSize` | CSS class   | Medium   |


---

## 8. CSS Files

### 8.1 `src/styles/styles.css`


| Issue                                      | Location                           | Refactor To                                                   | Priority |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------- | -------- |
| Hardcoded `rgba(0,0,0,0.08)` in box-shadow | Multiple (e.g. lines 70, 83, 106)  | `var(--background-modifier-box-shadow)` or theme-aware shadow | High     |
| Hardcoded hex fallbacks                    | `var(--text-normal, #24292e)` etc. | Prefer no fallback or use Obsidian's fallbacks                | Low      |
| Hardcoded `rgba(255,255,255,0.95)`         | Line 3316                          | `var(--background-primary)` with opacity if needed            | Medium   |


### 8.2 `src/styles/calendar-chart.css`


| Issue                            | Location       | Refactor To                                           | Priority |
| -------------------------------- | -------------- | ----------------------------------------------------- | -------- |
| `stroke: rgba(27, 31, 35, 0.15)` | Lines 220, 225 | `var(--background-modifier-border)` or theme variable | High     |


### 8.3 `src/styles/domain-distribution.css`


| Issue                                    | Location | Refactor To                                               | Priority |
| ---------------------------------------- | -------- | --------------------------------------------------------- | -------- |
| `text-shadow: 0 1px 2px rgba(0,0,0,0.5)` | Line 71  | Theme variable or `var(--background-modifier-box-shadow)` | Low      |


---

## 9. Summary by Priority

### High Priority (Theme compatibility, maintainability)

1. **VaultAnalysisModal** – Move inline modal/content styles to CSS; use CSS variables
2. **KnowledgeStructureManager** – Extract 50+ inline styles to CSS classes; replace hardcoded `rgba`
3. **VaultAnalysisModals empty states** – Extract to `.empty-state` class
4. **KnowledgeEvolutionManager / KnowledgeActionsManager** – Extract empty state styles
5. **styles.css** – Replace hardcoded `rgba` in box-shadows with theme variables
6. **calendar-chart.css** – Replace hardcoded stroke colors

### Medium Priority (Consistency, UX)

1. **GraphView color settings** – Consider `Setting.addToggle`/`addDropdown` if moved to a settings panel
2. **VaultAnalysisModal search** – Use `Setting.addSearch()` or styled input with CSS variables
3. **AISummaryModal** – Use `MarkdownRenderer` for content
4. **VaultSemanticAnalysisManager** – Style Notice button with CSS class
5. **CentralityResultsView** – Extract pagination styles to CSS
6. **CentralityKDEChart / ConnectivityScatterChart** – Consolidate tooltip styles

### Low Priority (Nice to have)

1. **ExcludedFilesModal** – Consider `FuzzySuggestModal` for long lists
2. **GraphView gradient picker** – Consider `FuzzySuggestModal` for palette selection
3. **Settings "Show excluded files"** – Use `Setting.addButton()`
4. **ConnectionSubgraph / DomainDistributionChart** – D3 font sizing
5. **Hex fallbacks in styles.css** – Remove or align with Obsidian

---

## 10. Recommended Refactoring Order

1. **Phase 1 – CSS variables**: Replace all hardcoded `rgba()` and hex in `styles.css`, `calendar-chart.css`, `domain-distribution.css`
2. **Phase 2 – Inline styles → CSS classes**: Extract inline styles in KnowledgeStructureManager, VaultAnalysisModals, empty states
3. **Phase 3 – Modal layout**: Move VaultAnalysisModal inline styles to CSS
4. **Phase 4 – Setting API**: Migrate custom buttons/inputs to `Setting` where applicable
5. **Phase 5 – Optional**: Consider `FuzzySuggestModal` for long lists and palette selection

