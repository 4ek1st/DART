## Reliable update discovery

- Honor GitHub retry and rate-limit reset times across manual checks, window
  focus, network recovery, multiple windows and restarts.
- Discover signed public releases through their direct GitHub asset when the API
  is temporarily unavailable. Signature, ancestry, version, file size and SHA-256
  checks remain required. Private tokens stay confined to the API path.
- Keep previously verified updates installable during temporary failures and pin
  executable downloads to the version from the verified manifest.
- Show a waiting indicator and the next automatic check time in English, Russian
  and German. Display the waiting reason once, while preserving distinct notices.
- Lock installation controls while saving the session and preparing an update.
  A failed session save prevents installation and restores update checks.
