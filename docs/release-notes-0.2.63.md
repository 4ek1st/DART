## Faster Favorites and consistent controls

- Favorites reuses recommendation evidence and indexes cover candidates instead of repeatedly scanning the whole liked library. Likes, tag preferences, ratings and metadata changes refresh the relevant caches.
- Character covers show a work tagged with only that character. The `solo` tag is optional. Existing viewed and liked works supply the cover; missing matches retain their collection and statistics.
- Mine / System picks sits at the top right of the Favorites filter panel. Shared filters and action buttons use the same raised and segmented appearance, with light, dark and List themes retained.
- Hover gently expands the complete artwork frame instead of zooming inside a fixed crop. Grid measurements stay stable; dragging, unavailable previews and reduced-motion mode stay still.
- Artwork menus omit Copy image link and Copy all artwork tags. Copying all tags remains available through a tag's context menu.
- U starts upscaling when needed, then switches between the original and the completed result without processing it again.
- Settings → Image upscaling adds an optional automatic mode, off by default. It uses the saved 2× or 4× scale for loaded images visible in artwork and Space/fullscreen viewers. It requires the installed optional module, preserves manual comparison choices and cancels automatic work when its image leaves the active view.
