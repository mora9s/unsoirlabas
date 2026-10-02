# Book PDF cover clipping regression

- Production Chrome download: `test-results/book-export-120-character--790cb-d-leaves-room-for-its-photo-production-preview/long-title-book.pdf` (896,606 bytes, 2 A4 pages).
- `pdftotext` preserved the full 120-character French single-token cover title and long chapter title; the long destination also extracted intact. Only the selected trip's chapter appeared.
- PyMuPDF text-span bounds on the cover: x=58.00–536.47 pt (inside the 58–537.28 pt safe area); cover photo rect=(58.00, 363.89, 537.28, 683.29) pt, with 39.52 pt between the last cover text span and photo. Cover title and photo both fit the 595.28×841.89 pt A4 page.
- Added Playwright artifact regression checks for extraction, safe text bounds, title/photo non-overlap and trip isolation. The existing anonymous fixture `evidence/personal-book-fixture.pdf` was regenerated from a real Chrome download (4 A4 pages, 2 embedded images).
- Verification: focused Chrome book-PDF tests 3 passed; canonical one-worker Playwright suite 114 passed / 4 skipped (118 total); backend pytest 13 passed; `npm run lint` and `npm run build` passed. Backend output included existing FastAPI lifecycle deprecation warnings.
