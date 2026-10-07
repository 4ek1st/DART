# DART 0.2.24

## Heart feedback at the pointer

- Double-clicking an artwork image now shows a small pink heart at the exact pointer position. It gently pops in, then fades away within one second.
- The same feedback works on artwork thumbnails, video thumbnails, every full-size image in a grouped work, and quick or full-screen previews, including zoomed images.
- The decorative heart remains above modal previews and passes mouse input through. It does not move keyboard focus or change the artwork navigation.
- Repeated double clicks move and restart one heart instead of accumulating overlays. Feedback appears immediately while the existing like save runs, including when the work is already liked.
- With reduced motion enabled, the heart stays still for one second. Single clicks, hearts and F keep their existing behavior.

Verified in hidden Edge at 2560 x 1440 and 1100 x 720, with exact pointer positions, one-second cleanup, light theme, reduced motion, repeat clicks and a slow save. The running application and original profile were not replaced. Install through DART's update button.
