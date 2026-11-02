# Android 0.1.15 verification

Scope: remove the Android in-app updater at the user's request and retain the artwork action fixes. Windows updater, provider logic, recommendation ranking, profile format and signing identity are unchanged.

Removed AppUpdates, UpdatesUi, UpdateInstallRequest, their debug probe/tests, background startup/foreground checks, observer lifecycle, update arrows/settings route, APK downloader/installer, update FileProvider and REQUEST_INSTALL_PACKAGES. About DART retains an ordinary HTTPS release link. Old saved Updates routes normalize to the settings index; profile flush onStop and browsing cleanup remain intact. The static update.json is only a final migration descriptor for installed 0.1.14 clients; the new APK has no reader for it.

Artwork actions are Like, Bookmark, Download original and Open source. The redundant Original publication row is removed for all attribution preferences. Original URL metadata is preserved, and selecting Original link applies it to the source action. Native UI checks in an owned hidden API35 emulator confirm action order, persisted likes/bookmarks, original URL preservation, an actual ACTION_VIEW intent to the chosen neutral original URL, and a compact 320dp layout with 130% font. The physical phone and personal profile are not controlled.

The final source is clean-built to avoid stale deleted classes. Remaining unit tests, release lint, signed-package inspection and install-over-0.1.14 verification are recorded after completion. Release verification must confirm no installer permission/provider and no own updater classes in DEX, along with retained profile contents and the About release link.

The Play Protect warning reported for 0.1.14 remains an external classification. Removal of the updater is verified locally; successful installation in the isolated emulator and signature checks do not establish that Google has cleared its verdict. No external APK scan or Google appeal has been submitted by this work.
