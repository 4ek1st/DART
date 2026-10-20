## Reliable update discovery

- Honor GitHub Retry-After and rate-limit reset times. Manual checks, window
  focus, network recovery, multiple windows and restarts respect the same pause.
  Ordinary temporary failures use a bounded increasing retry delay.
- Discover signed public releases through their direct GitHub asset when the API
  is temporarily unavailable. Private tokens remain confined to the API path.
  Signature, version, release ancestry, file size and SHA-256 checks still apply.
- Pin downloads to the version from the verified manifest so a changing latest
  release cannot substitute another executable. A previously verified offer
  remains installable during temporary failures; invalid metadata clears it.
- Show a waiting indicator and the next automatic check time in English, Russian
  and German. A failed check no longer looks like a successful up-to-date result.
- Keep installation controls locked while saving the session and installing.
  Background checks cannot unlock a second installation, and a failed session
  save prevents installation and restores update checks.
