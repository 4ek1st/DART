# DART 0.2.17

- Hover over a video thumbnail to cycle through five frames sampled across the clip. Moving away restores the original thumbnail. Keyboard focus works too.
- The same preview is available on video cards from Danbooru, Gelbooru, Rule34 and Sankaku, including Liked, Following, search and artist pages.
- Frames are small and reused from a bounded cache. Only one video is decoded at a time; brief pointer movements do not start downloads. Preview preparation stops when leaving a card, scrolling, switching pages or hiding the window.
- A separate range proxy limits preview transfers and keeps full video playback independent. Slow or unavailable previews retain the existing thumbnail.
- Background list refreshes keep the displayed frame stable. Previews respect reduced motion and include English, Russian and German tooltips.
