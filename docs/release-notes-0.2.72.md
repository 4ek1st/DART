# Reliable update discovery

- Public Windows updates are checked directly through the signed release manifest. A GitHub API quota pause can no longer hide a published public update.
- Retry state distinguishes the public-manifest route from the previous API-led route. Actual public download rate limits and temporary failures still back off across windows and restarts.
- Private repositories retain authenticated API discovery. Signature, executable hash, release ancestry and version checks remain required before installation.
