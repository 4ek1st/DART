# Following order and smoother browsing

- Added Date / Random to Following. Date keeps the existing publication order; Random mixes followed artists and older/newer loaded works. Background arrivals and pagination keep already shown positions. The selected mode and shuffle seed are saved. Refresh creates a fresh shuffle.
- Fixed Space preview returning keyboard focus to Home or Back after closing. Focus returns to the artwork, Space reopens its preview, and Enter opens its details. Native video controls and text inputs retain their keyboard behavior.
- Removed repeated full-collection grouping when stepping between saved works with quality settings enabled. Unchanged hidden-work filters also reuse their prepared results.
- Closed previews release their unneeded navigation snapshots. Routes still used by a tab or browser history remain available.
- Expired Sankaku full-size images in previews use the existing bounded link renewal instead of remaining stuck on a thumbnail.
- Fixed video double-clicks being treated as image likes. Mouse controls and focused-video Space playback remain available.
- Prevented duplicate follow requests and older subscription responses from replacing a newer result. Corrected search counts after hidden-work and Q/NSFW filtering.
- Restored the Upscale settings section correctly after restarting.
