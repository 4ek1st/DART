# DART for Android 0.1.13

- Replaced the four cramped settings tabs with a native phone settings index. Content, Curation, Creators, Sources, Tabs, Appearance, Privacy, Profile transfer, Language and About are directly accessible, with outline icons and short descriptions matching the desktop organization.
- Settings open as separate scrollable pages. Grouped cards, full-row switches, readable radio choices and labelled fields wrap on small screens and at larger font sizes. The main bottom navigation is hidden inside settings to leave room for content and the keyboard.
- Moved each source connection to its own page. Existing authentication, encrypted credentials, blank-key preservation and validation are retained. Connection status updates when a save completes, including after returning to the source list.
- Simple switches and radio preferences save immediately. Theme, language, connection forms and excluded-tag edits keep their explicit apply/save actions. Settings routes, scroll positions and the non-secret excluded-tag draft survive activity recreation; returning from a nested settings page keeps its list position.
- Profile transfer keeps its explicit, initially unchecked consent step. Existing profile collections and source formats are unchanged.
- English, Russian and German cover the new settings. Regenerating the language table also preserves existing mobile-specific messages.
- About shows the installed version and links to Android releases. Install the APK over the existing app to retain your profile.

No desktop update is required for this Android settings change. The package and signing identity remain the same.
