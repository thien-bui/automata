## Global layout mode

A single toggle that switches the default for all widgets: Compact ↔ Detailed.

This should immediately update any widget that's "using global."

## Per-widget override

Each widget has a small control with three choices:

Use global (default)

Force compact

Force full

## Persistence & predictability

Persist both the global mode and any per-widget overrides.

New widgets default to Use global.

### Accessibility & affordance

The global toggle should have a clear label (e.g., "Compact mode") and reflect current state.

## Implementation Questions

### Storage Location
- **Answer**: Use localStorage for persistence

### Default State
- **Question**: Should the initial global mode be Compact or Detailed when a user first visits?
- **Answer**: Initial state should be compact

### Widget Identification
- **Question**: How should widgets be uniquely identified? (By component name, ID, or some other method?)
- **Answer**: Should be identified by component name

### UI Implementation
- **Question**: Where should the global toggle be placed? (Settings drawer, header, or somewhere else?)
- **Answer**: Should be on the title bar elements.
- **Question**: What should the per-widget control look like? (Dropdown, toggle switch, or icon buttons?)
- **Answer**: Should be a toggle switch.

### Implementation Scope
- **Question**: Should this be implemented for all existing widgets (Weather, Route, Member Status, Polling, etc.) or only specific ones?
- **Answer**: Implement in existing main widget: Weather, Route, Discord (Member status). Updated depdendant components like polling widget.

### State Management
- **Question**: Should this use the existing `useUiPreferences` composable or require a new dedicated composable?
- **Answer**: Reuse useUiPreferences to manage state for the global state and each widgets compact state.

### Migration Strategy
- **Question**: How should existing widget states be handled when this feature is first introduced?
- **Answer**: Default all widget to compact mode.

### Testing Requirements
- **Question**: What level of testing is expected? (Unit tests, E2E tests, or both?)
I want more unit tests and a high level E2E test to ensure that the widget recieves the global toggle events.
