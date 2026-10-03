# Tabsira 1.1.0 compatibility

Both Chromium-family MV3 and Firefox MV3 development packages are generated. Building a package is not a browser compatibility pass.

| Target | Manifest minimum | 1.1.0 runtime evidence |
|---|---|---|
| Chromium | 120 | Installed ZIP:44/44 PASS on Chromium141.0.7390.37/GitHub Linux; expanded click checks in CI |
| Google Chrome stable / Edge / Brave / Opera | Chromium-family | Not yet independently verified for 1.1.0 |
| Firefox | 128 | Package/static checks only; new features not runtime verified |
| Private/incognito windows | Chromium split / Firefox default | Concurrency simulated; new 1.1.0 real-browser coverage pending |
| Windows / macOS / user devices | Platform-dependent | Not verified |

The historical 1.0.0 browser results remain in git/evidence for traceability. They do not certify 1.1.0. Optional `activeTab` and notification permission flows need testing in each intended store browser. Firefox signing/store approval remains a separate release step.
