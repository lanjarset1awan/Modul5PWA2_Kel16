# Bore & Barrel — Progressive Web App (PWA) II

A dummy tactical hardware storefront built as a Progressive Web App (PWA) with React 19, Vite, and Tailwind CSS. Runs fully offline with an App Shell architecture, Web App Manifest, Service Worker (Workbox), Code-splitting Lazy Loading, In-Memory Query Caching, Deep-Link Sharelinks, and Interactive Pagination.

## Fitur Tugas Praktikum Modul 5

1. **PWA Architecture & Offline Capability**:
   - Web App Manifest (`vite.config.js`) dengan metadata standalone, tema, dan ikon beresolusi tinggi.
   - Service Worker via `vite-plugin-pwa` (Workbox precaching) untuk caching offline aset statis.
   - Dual-source catalog: Live API dengan fallback otomatis ke static dataset (`GUNS_LOCAL`).

2. **Lazy Loading & Query Caching**:
   - **Code Splitting (React.lazy + Suspense)**: Halaman (`Catalog`, `GunDetail`, `CreateGunPage`, `EditGunPage`, dll.) dimuat secara dinamis saat diakses untuk mengurangi ukuran initial bundle JS.
   - **Image Lazy Loading**: Atribut `loading="lazy"` dan `decoding="async"` pada aset gambar.
   - **In-Memory Query Caching (`queryCache.js`)**: Cache berbasis `Map` dengan Time-To-Live (TTL 5 menit). Menyajikan data instan (0 ms) saat berpindah tab.
   - **Cache Invalidation**: Otomatis membersihkan cache saat terjadi mutasi data (CREATE, UPDATE, DELETE).

3. **Sharelink & Deep Linking**:
   - Utilitas `shareHelper.js` mendukung **Web Share API** (`navigator.share`) dengan fallback otomatis ke **Clipboard API** (`navigator.clipboard.writeText`) disertai notifikasi toast.
   - **Deep Linking**: Tautan menyertakan query parameter `?gun=<id>`, sehingga saat dibuka di browser atau tab baru, aplikasi langsung membuka detail produk yang dimaksud secara otomatis.

4. **Paginasi Katalog**:
   - Kontrol paginasi interaktif (`Pagination.jsx`) dengan tombol *Prev*, *Next*, nomor halaman, info kuantitas, dan pilihan *items per page* (4, 6, 8, 12).
   - Auto-reset ke halaman 1 saat pengguna melakukan filter pencarian, kategori, atau sorting.

## Setup & Menjalankan Proyek

```bash
npm install
npm run dev      # Menjalankan development server dengan HMR (http://localhost:5173)
```

Perintah lainnya:

```bash
npm run build    # Melakukan build produksi ke dist/ dengan pemisahan chunk lazy-loading
npm run preview  # Menjalankan preview dari build produksi
npm run lint     # Menjalankan linter oxlint
```

## Struktur Proyek

```
.
├── index.html                       # HTML shell
├── vite.config.js                   # Vite + vite-plugin-pwa (manifest & workbox precaching)
├── public/                          # Static assets
│   ├── icon-192.png / icon-512.png / icon.svg
│   └── guns/                        # SVG product assets
└── src/
    ├── main.jsx                     # Entry point
    ├── App.jsx                      # App Shell (React.lazy, Suspense, Deep Linking ?gun=)
    ├── App.css                      # Styling termasuk paginasi, cache status, & share button
    ├── index.css                    # Design tokens & CSS variables
    ├── components/
    │   ├── Header.jsx               # Navigation bar
    │   ├── Footer.jsx               # Footer
    │   ├── PWABadge.jsx             # PWA update prompt
    │   ├── common/
    │   │   ├── Pagination.jsx       # Reusable pagination controls
    │   │   ├── ShareButton.jsx      # Web Share API & Clipboard fallback button
    │   │   ├── AdvancedFilter.jsx   # Search & filter bar
    │   │   └── FavoriteButton.jsx   # Bookmark button
    │   ├── gun/
    │   │   ├── GunCard.jsx          # Product card with share & lazy image
    │   │   └── GunDetail.jsx        # Detailed view with specs, reviews, & share
    │   └── modals/
    │       └── ConfirmModal.jsx     # Delete confirmation modal
    ├── data/
    │   └── guns.js                  # Local product dataset (12 items for pagination)
    ├── hooks/
    │   ├── useGuns.js               # Query cached data fetching hook
    │   ├── useFavorites.js          # Favorites hook
    │   └── useReviews.js            # Product reviews hook
    ├── pages/
    │   ├── Catalog.jsx              # Paginated product grid with cache status toolbar
    │   ├── CreateGunPage.jsx        # Add product form
    │   ├── EditGunPage.jsx          # Edit product form
    │   ├── FavoritesPage.jsx        # Saved products page
    │   ├── ProfilePage.jsx          # User profile
    │   ├── About.jsx
    │   └── Contact.jsx
    ├── services/
    │   ├── gunService.js            # API CRUD with cache invalidation
    │   └── favoriteService.js
    └── utils/
        ├── queryCache.js            # In-memory TTL query cache manager
        ├── shareHelper.js           # Web Share & deep link generator
        └── helpers.js               # Formatting, search, & filter helpers
```
