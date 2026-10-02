Phase 1 — Store + versioning + migrations



Phase 2 — Render seam


Read docs/transformation/README.md, docs/transformation/PROTOCOL.md, and docs/transformation/phase-2-render-seam.md. Confirm Phase 1 is ✅ in docs/transformation/TRACKER.md, then implement Phase 2. The primary gate is pixel-identical PNG regression. Do not touch anything outside the scope defined in that phase file. When done, update TRACKER.md and report back per the handoff protocol.

Phase 3 — Backend API


Read docs/transformation/README.md, docs/transformation/PROTOCOL.md, and docs/transformation/phase-3-backend-api.md. Confirm Phases 1 and 2 are ✅ in docs/transformation/TRACKER.md, then implement Phase 3. When done, update TRACKER.md and report back per the handoff protocol.


Phase 4 — Studio + palette editor + version display


Read docs/transformation/README.md, docs/transformation/PROTOCOL.md, and docs/transformation/phase-4-studio-and-palette-editor.md. Confirm Phases 1, 2, and 3 are ✅ in docs/transformation/TRACKER.md, then implement Phase 4. When done, update TRACKER.md and report back per the handoff protocol.

Phase 5 — UI restructure: Device / Studio / Diagnostics


Read docs/transformation/README.md, docs/transformation/PROTOCOL.md, and docs/transformation/phase-5-ui-restructure.md. Confirm Phase 4 is ✅ in docs/transformation/TRACKER.md, then implement Phase 5. When done, update TRACKER.md and report back per the handoff protocol.




Phase 6 — Mobile-friendly layout + touch pixel editor


Read docs/transformation/README.md, docs/transformation/PROTOCOL.md, and docs/transformation/phase-6-mobile-and-touch.md. Confirm Phase 5 is ✅ in docs/transformation/TRACKER.md, then implement Phase 6. When done, update TRACKER.md and report back per the handoff protocol.



Phase 7 — Maturity extras + teardown


Read docs/transformation/README.md, docs/transformation/PROTOCOL.md, and docs/transformation/phase-7-maturity-extras.md. Confirm all prior phases are ✅ in docs/transformation/TRACKER.md, then implement Phase 7. This is the closing phase — after all tasks are done and durable docs are updated, delete the entire docs/transformation/ directory as specified in the phase file and PROTOCOL.md.




A few practical notes:

Phases 1 and 2 have no UI, so you can run them even without the device connected. They're the safest to start with.
After Phase 2, run npm test yourself and sanity-check the PNG output once — it's the make-or-break regression gate for the whole chain.
Phase 4 needs the full stack (npm run dev) to test end-to-end save; dev:sim alone isn't enough once it talks to the real API.
Phase 7 ends with deleting docs/transformation/ — make sure all prior phases are solid before dispatching it.