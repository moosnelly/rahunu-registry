# Keyboard Shortcuts Documentation

This document describes the keyboard shortcuts implementation in the Rahunu Registry application.

## Overview

The application includes a comprehensive keyboard shortcuts system that allows users to navigate and perform actions quickly without using the mouse. All shortcuts are displayed with styled `kbd` elements from shadcn/ui for visual consistency.

## Features

### 1. Global Keyboard Shortcuts
- **No browser conflicts**: Uses `Alt` key for most shortcuts to avoid conflicts with browser shortcuts (Ctrl+N, Ctrl+T, Ctrl+R, etc.)
- **Cross-platform support**: Automatically detects Mac (⌥) vs Windows/Linux (Alt) modifiers
- **Smart context awareness**: Shortcuts are disabled when typing in input fields (except Escape and `/`)
- **Visual indicators**: Keyboard shortcuts are displayed inline on buttons and inputs throughout the UI
- **Help dialog**: Press `Ctrl+K` / `⌘+K` to view all available shortcuts

### 2. Keyboard Shortcuts Button
A dedicated button in the header (keyboard icon) provides quick access to the keyboard shortcuts help dialog.

### 3. Styled with shadcn/ui kbd Component
All keyboard shortcuts are styled using the `Kbd` and `KbdGroup` components from shadcn/ui for consistent visual appearance.

## Available Shortcuts

### Navigation Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Alt+D` / `⌥+D` | Dashboard | Navigate to the Dashboard page |
| `Alt+E` / `⌥+E` | Entries | Navigate to the Entries page |
| `Alt+R` / `⌥+R` | Reports | Navigate to the Reports page |
| `Ctrl+Shift+U` / `⌘+Shift+U` | User Management | Navigate to User Management (Admin only) |
| `Ctrl+Shift+A` / `⌘+Shift+A` | Audit Log | Navigate to Audit Log (Admin only) |
| `Ctrl+Shift+S` / `⌘+Shift+S` | System Settings | Navigate to System Settings (Admin only) |

### Action Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Alt+N` / `⌥+N` | New Entry | Create a new registry entry (requires write permission) |

### UI Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Alt+T` / `⌥+T` | Toggle Theme | Switch between light and dark theme |
| `Alt+B` / `⌥+B` | Toggle Sidebar | Show/hide the sidebar |
| `Ctrl+K` / `⌘+K` | Show Shortcuts | Display the keyboard shortcuts help dialog |

### Search Shortcuts
| Shortcut | Action | Description |
|----------|--------|-------------|
| `/` | Focus Search | Focus and select the search input field (just press `/`)|

## Implementation Details

### Components

#### 1. `use-keyboard-shortcuts.tsx` (Hook)
- Custom React hook that registers keyboard event listeners
- Provides `useKeyboardShortcuts()` for custom shortcuts
- Provides `useGlobalKeyboardShortcuts()` for predefined app-wide shortcuts
- Handles platform detection (Mac vs Windows/Linux)
- Prevents shortcuts from firing when user is typing in input fields

#### 2. `keyboard-shortcuts-provider.tsx` (Provider)
- Client component that wraps the app
- Initializes global keyboard shortcuts
- Renders the keyboard shortcuts help dialog

#### 3. `keyboard-shortcuts-dialog.tsx` (Dialog)
- Modal dialog that displays all available shortcuts
- Groups shortcuts by category (Navigation, Actions, UI, Search)
- Shows platform-specific modifier keys (⌘ for Mac, Ctrl for others)
- Automatically opens/closes via custom event

#### 4. `keyboard-shortcuts-button.tsx` (Button)
- Header button with keyboard icon
- Includes tooltip showing `Ctrl+K` / `⌘+K` shortcut
- Triggers the shortcuts help dialog

#### 5. `kbd.tsx` (shadcn/ui Component)
- Styled keyboard key component
- Provides `Kbd` for individual keys
- Provides `KbdGroup` for key combinations

### Integration Points

#### Layout (`src/app/layout.tsx`)
```tsx
<KeyboardShortcutsProvider>
  {/* App content */}
</KeyboardShortcutsProvider>
```

#### Header
- Keyboard shortcuts button added to the header
- Positioned next to the theme switcher

#### Dashboard (`src/app/dashboard/page.tsx`)
- Action buttons show keyboard shortcuts inline
- "View Entries" button shows `Alt+E`
- "Reports" button shows `Alt+R`
- "Create New Entry" button shows `Alt+N`

#### Entries Page (`src/app/entries/page.tsx`)
- "New Entry" button shows `Alt+N`
- Search input shows `/` when empty

### Styling

The `Kbd` component uses the following styles:
```css
- Background: bg-muted
- Text color: text-muted-foreground
- Height: h-5
- Padding: px-1
- Border radius: rounded-sm
- Font size: text-xs
```

### Browser Compatibility

The keyboard shortcuts system is compatible with:
- ✅ Chrome/Edge (Windows, Mac, Linux)
- ✅ Firefox (Windows, Mac, Linux)
- ✅ Safari (Mac)
- ✅ Mobile browsers (shortcuts button still visible, dialog accessible)

## Usage Guidelines

### For Developers

1. **Adding new shortcuts**: Add to the `shortcuts` array in `useGlobalKeyboardShortcuts()`
2. **Custom shortcuts**: Use `useKeyboardShortcuts()` hook with custom shortcuts array
3. **Displaying shortcuts**: Use `<Kbd>` and `<KbdGroup>` components for visual consistency

Example:
```tsx
import { Kbd, KbdGroup } from '@/components/ui/kbd'

<Button>
  Save
  <KbdGroup>
    <Kbd>Ctrl</Kbd>
    <span>+</span>
    <Kbd>S</Kbd>
  </KbdGroup>
</Button>
```

### For Users

1. Press `Ctrl+K` / `⌘+K` anytime to view all available shortcuts
2. Click the keyboard icon in the header to view shortcuts
3. Look for keyboard shortcut indicators on buttons (shown on larger screens)
4. Most navigation shortcuts use `Alt` key to avoid conflicts with your browser
5. Shortcuts work globally except when typing in text fields (you can still use `/` for search and `Escape` to close dialogs)

## Accessibility

- All shortcuts are keyboard-accessible
- Screen readers can access the keyboard icon button
- Shortcuts dialog is properly announced
- ARIA labels are used throughout
- Focus management is handled correctly

## Future Enhancements

Potential improvements for future versions:
- [ ] Customizable shortcuts (user preferences)
- [ ] Shortcut to go back/forward in navigation history
- [ ] Form-specific shortcuts (save, cancel, submit)
- [ ] Quick command palette (similar to Cmd+K in VS Code)
- [ ] Export/print keyboard shortcuts reference sheet
- [ ] Context-specific shortcuts based on current page
- [ ] Shortcut conflicts detection and resolution

## Testing

To test keyboard shortcuts:
1. Navigate to any page in the app
2. Try each shortcut from the table above
3. Verify shortcuts don't fire when typing in input fields
4. Test on both Mac and Windows/Linux
5. Verify visual indicators appear on buttons
6. Test the help dialog (`Ctrl+K`)

## Notes

- **Browser Conflict Avoidance**: Main navigation shortcuts use `Alt` (⌥ on Mac) to prevent conflicts with browser shortcuts like `Ctrl+N` (new window), `Ctrl+T` (new tab), and `Ctrl+R` (reload)
- The `Ctrl` key on Windows/Linux maps to `Cmd` (⌘) on Mac automatically
- The `Alt` key on Windows/Linux maps to `Option` (⌥) on Mac automatically
- Admin-only shortcuts will navigate to admin pages but access control is enforced server-side
- The system uses custom events for communication between components
- Search shortcut (`/`) is inspired by common patterns in apps like GitHub, Gmail, and Slack

