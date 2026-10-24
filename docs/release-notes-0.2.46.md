## Sankaku image previews

- Fixed valid AVIF previews appearing as Image unavailable when the CDN labels
  them as generic binary data.
- Detect supported image formats from their bytes for generic binary responses.
  HTML, unknown binary data and video containers remain rejected. Existing
  image size limits and source restrictions still apply.
