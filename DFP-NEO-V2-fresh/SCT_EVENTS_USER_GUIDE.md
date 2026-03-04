# SCT Events Configuration - User Guide

## Quick Start

### Accessing SCT Events Configuration
1. Click on **"Settings"** in the left sidebar
2. Scroll to find the **"SCT Events"** window
3. The window displays all configured SCT event types

## Default Configuration

Your system comes pre-configured with these SCT events:
- **SCT GF** - Standards Check Training General Flying
- **SCT IF** - Standards Check Training Instrument Flying
- **SCT Form** - Standards Check Training Formation
- **SCT Nav** - Standards Check Training Navigation

## How to Add a New SCT Event

1. Click the **"Edit"** button in the SCT Events window header
2. Type the new event name in the text input field at the bottom
   - Example: "SCT Low Level"
3. Click the green **"+"** button
4. The new event appears in the list above
5. Click **"Save"** to keep your changes

**Note**: You cannot add duplicate events. If an event already exists, it won't be added again.

## How to Remove an SCT Event

1. Click the **"Edit"** button in the SCT Events window header
2. Find the event you want to remove in the list
3. Click the red **"×"** button next to that event
4. The event is removed from the list
5. Click **"Save"** to confirm the deletion

## How to Cancel Changes

If you've made changes but want to discard them:
1. Click the **"Cancel"** button in the header
2. All unsaved changes are discarded
3. The list returns to its previous state

## Tips & Best Practices

### Naming Conventions
- Use clear, descriptive names
- Consider using prefixes like "SCT" for consistency
- Keep names concise but meaningful
- Examples:
  - ✅ Good: "SCT GF", "SCT Nav", "SCT Form"
  - ❌ Avoid: "Event1", "Test", "ABC"

### Organization
- Group similar events together
- Use consistent abbreviations
- Consider alphabetical ordering for easy finding

### Common SCT Event Types
Here are some commonly used SCT event types you might want to add:
- SCT GF (General Flying)
- SCT IF (Instrument Flying)
- SCT Form (Formation)
- SCT Nav (Navigation)
- SCT Low Level
- SCT Night
- SCT Aerobatics
- SCT Tactical

## Frequently Asked Questions

### Q: Are my changes saved permanently?
**A**: Changes persist during your current session. For permanent storage across browser sessions, the system would need to be configured with database or localStorage persistence.

### Q: Can I reorder the events?
**A**: Currently, events appear in the order they were added. Reordering functionality may be added in a future update.

### Q: What happens if I delete all events?
**A**: You can delete all events if needed. The list will be empty until you add new ones.

### Q: Can I edit an existing event name?
**A**: Currently, you need to delete the old event and add a new one with the updated name.

### Q: Is there a limit to how many events I can add?
**A**: There's no hard limit, but the list becomes scrollable after a certain height for better usability.

### Q: Can other users see my changes?
**A**: Changes are currently stored in your local session. For multi-user environments, server-side storage would be needed.

## Troubleshooting

### Problem: The "+" button doesn't work
**Solution**: Make sure you've typed something in the input field. Empty inputs cannot be added.

### Problem: I can't add an event
**Solution**: Check if the event already exists in the list. Duplicate events are not allowed.

### Problem: My changes disappeared
**Solution**: Make sure you clicked "Save" before closing the edit mode. Clicking "Cancel" discards all changes.

### Problem: The list is too long to see all events
**Solution**: The list automatically becomes scrollable. Use your mouse wheel or scrollbar to view all events.

## Visual Reference

### View Mode
```
┌─────────────────────────────────┐
│ SCT Events              [Edit]  │  ← Click to enter edit mode
├─────────────────────────────────┤
│ Configured SCT event types.     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ SCT GF                      │ │  ← Read-only list
│ │ SCT IF                      │ │
│ │ SCT Form                    │ │
│ │ SCT Nav                     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Edit Mode
```
┌─────────────────────────────────┐
│ SCT Events        [Save][Cancel]│  ← Save or Cancel changes
├─────────────────────────────────┤
│ Manage SCT event types.         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ SCT GF                  [×] │ │  ← Click × to remove
│ │ SCT IF                  [×] │ │
│ │ SCT Form                [×] │ │
│ │ SCT Nav                 [×] │ │
│ └─────────────────────────────┘ │
│                                 │
│ [New SCT event name...    ] [+] │  ← Type and click + to add
└─────────────────────────────────┘
```

## Integration with Other Features

The SCT events you configure here can be used throughout the application:
- **Event Creation**: Select from your configured SCT events when creating new schedule items
- **Filtering**: Filter schedules by specific SCT event types
- **Reporting**: Generate reports based on SCT event categories
- **Analytics**: Track usage and statistics for each SCT event type

## Support

If you encounter any issues or have suggestions for improvements:
1. Check this user guide for solutions
2. Review the technical documentation (SCT_EVENTS_FEATURE.md)
3. Contact your system administrator
4. Submit feedback through the application

---

**Last Updated**: 2024-11-29
**Version**: 1.0
**Feature Status**: Active