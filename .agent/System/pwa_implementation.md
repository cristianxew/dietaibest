# Progressive Web App (PWA) Implementation

**Last Updated:** 2026-01-18

---

## Overview

DietAI is now a fully-functional Progressive Web App (PWA), enabling users to install the application on their devices and use it offline with cached resources. This implementation uses `next-pwa` to provide service worker functionality and comprehensive caching strategies.

---

## Features

### 1. Installable Application
- Users can install DietAI on their devices (desktop and mobile)
- Provides a native app-like experience
- Launches in standalone mode without browser UI
- Custom app icon and splash screens

### 2. Offline Support
- Service worker caches static assets
- Pages work offline with cached content
- Automatic background sync when connection restored

### 3. Optimized Caching
- **Fonts**: Google Fonts cached for 1 year
- **Images**: Static images cached for 24 hours
- **Scripts/Styles**: Cached for 24 hours with stale-while-revalidate
- **API Routes**: Excluded from caching for data freshness
- **Next.js Data**: Cached with revalidation strategy

---

## Technical Implementation

### Configuration Files

#### 1. next.config.ts
The PWA is configured using `next-pwa` with the following settings:

```typescript
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [...] // See detailed caching strategies below
});
```

**Key Settings:**
- `dest: "public"` - Service worker files generated in public directory
- `disable: process.env.NODE_ENV === "development"` - PWA disabled in dev mode for faster development
- `register: true` - Automatically register service worker
- `skipWaiting: true` - New service worker activates immediately

#### 2. public/manifest.json
Web app manifest defining app metadata:

```json
{
  "name": "DietAI - Autonomous Nutrition Operating System",
  "short_name": "DietAI",
  "description": "AI-powered meal planning and nutrition tracking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#22c55e",
  "orientation": "portrait-primary"
}
```

#### 3. src/app/layout.tsx
Root layout includes PWA metadata:

```typescript
export const metadata: Metadata = {
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#22c55e" },
    { media: "(prefers-color-scheme: dark)", color: "#16a34a" }
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DietAI"
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
};
```

---

## Caching Strategies

### 1. CacheFirst
Used for resources that rarely change:
- **Google Fonts webfonts**: 1 year expiration
- **Audio files**: 24 hours, range requests enabled
- **Video files**: 24 hours, range requests enabled

### 2. StaleWhileRevalidate
Used for resources that should be cached but updated in background:
- **Google Fonts stylesheets**: 1 week expiration
- **Font files**: 1 week expiration
- **Images**: 24 hours expiration
- **Next.js Image Optimization**: 24 hours
- **JavaScript files**: 24 hours
- **CSS files**: 24 hours
- **Next.js data files**: 24 hours

### 3. NetworkFirst
Used for resources that should be fresh when possible:
- **Static data files** (JSON, XML, CSV): 24 hours fallback
- **Application pages**: 24 hours fallback with 10s network timeout
- **API routes**: Excluded from caching (always fresh)

---

## PWA Icons

### Generated Icons
The following icons are auto-generated from `/public/mydietbook.png`:

| Icon | Size | Purpose |
|------|------|---------|
| icon-72x72.png | 72x72 | Small devices |
| icon-96x96.png | 96x96 | Small devices |
| icon-128x128.png | 128x128 | Medium devices |
| icon-144x144.png | 144x144 | Medium devices |
| icon-152x152.png | 152x152 | iPad |
| icon-192x192.png | 192x192 | Standard PWA icon |
| icon-384x384.png | 384x384 | Large devices |
| icon-512x512.png | 512x512 | Splash screens |
| apple-touch-icon.png | 180x180 | iOS home screen |
| favicon.ico | 32x32 | Browser tab |

### Regenerating Icons
To regenerate PWA icons from a new source image:

```bash
# 1. Replace the source image
cp /path/to/new-logo.png public/mydietbook.png

# 2. Run the icon generator script
bun run scripts/generate-pwa-icons.ts
```

The script uses `sharp` to resize images while maintaining quality.

---

## Development vs Production

### Development Mode
- PWA is **disabled** in development (`NODE_ENV === "development"`)
- No service worker registration
- No caching behavior
- Faster development with hot reload

### Production Mode
- PWA is **enabled** in production builds
- Service worker automatically registered
- All caching strategies active
- Offline support enabled

### Building for Production

```bash
# Build the application
bun run build

# Service worker files generated in /public:
# - sw.js (service worker)
# - workbox-*.js (workbox runtime)
# - fallback-*.js (offline fallback pages)
```

---

## Generated Files

The following files are auto-generated during production build and should NOT be committed to git:

```
/public/sw.js                  # Main service worker
/public/sw.js.map             # Source map
/public/workbox-*.js          # Workbox runtime
/public/workbox-*.js.map      # Source maps
/public/worker-*.js           # Additional workers
/public/worker-*.js.map       # Source maps
/public/fallback-*.js         # Offline fallback
/public/fallback-*.js.map     # Source maps
```

These are excluded in `.gitignore`.

---

## Testing PWA

### 1. Local Testing
```bash
# Build production version
bun run build

# Start production server
bun run start

# Visit http://localhost:3000
# Open DevTools > Application > Service Workers
```

### 2. Chrome DevTools
- **Application Tab** > **Manifest**: Verify manifest.json
- **Application Tab** > **Service Workers**: Check registration status
- **Application Tab** > **Cache Storage**: Inspect cached resources
- **Lighthouse**: Run PWA audit

### 3. Install Testing
- Look for "Install App" icon in browser address bar
- Click to install
- Verify standalone mode launch
- Test offline functionality

### 4. Mobile Testing
- Deploy to production
- Visit on mobile device
- Add to Home Screen
- Test offline mode by enabling airplane mode

---

## Browser Support

### Desktop
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Partial support (no install prompt)
- ❌ IE: Not supported

### Mobile
- ✅ Chrome Android: Full support
- ✅ Safari iOS: Partial support (Add to Home Screen)
- ✅ Samsung Internet: Full support
- ✅ Firefox Android: Full support

---

## Maintenance

### Updating the Manifest
Edit `/public/manifest.json`:
```json
{
  "name": "Updated App Name",
  "theme_color": "#new-color",
  // ... other properties
}
```

### Updating Caching Strategies
Edit `next.config.ts` > `runtimeCaching` array:
```typescript
{
  urlPattern: /your-pattern/,
  handler: "CacheFirst" | "NetworkFirst" | "StaleWhileRevalidate",
  options: {
    cacheName: "your-cache-name",
    expiration: {
      maxEntries: 32,
      maxAgeSeconds: 24 * 60 * 60
    }
  }
}
```

### Forcing Service Worker Update
Users receive updates automatically when:
1. They revisit the app
2. Service worker detects changes
3. New version installs and activates

To force immediate update, use `skipWaiting: true` (already enabled).

---

## Troubleshooting

### Service Worker Not Registering
1. Check browser console for errors
2. Verify production build: `NODE_ENV=production`
3. Ensure HTTPS in production (required for PWA)
4. Check DevTools > Application > Service Workers

### Offline Not Working
1. Verify service worker is active
2. Check cache storage in DevTools
3. Ensure resources are being cached
4. Check network tab for cache hits

### Install Prompt Not Showing
1. Verify manifest.json is valid
2. Ensure all required icons are present
3. Check PWA criteria in Lighthouse
4. Note: Some browsers don't show install prompt

### Stale Content After Update
1. Service worker uses `skipWaiting: true`
2. Hard refresh: Ctrl+Shift+R / Cmd+Shift+R
3. Unregister service worker in DevTools
4. Clear cache and reload

---

## Best Practices

### 1. API Routes
- ✅ Exclude from caching (already configured)
- ✅ Use NetworkFirst for dynamic data
- ❌ Don't cache authenticated endpoints

### 2. Static Assets
- ✅ Use long cache times for versioned assets
- ✅ Use StaleWhileRevalidate for images
- ✅ Optimize images before caching

### 3. Service Worker Updates
- ✅ Use `skipWaiting: true` for immediate updates
- ✅ Notify users of updates when appropriate
- ✅ Test update flow thoroughly

### 4. Offline Experience
- ✅ Provide offline fallback pages
- ✅ Show clear offline indicators
- ✅ Queue actions for background sync

---

## Future Enhancements

### Potential Improvements
1. **Background Sync**: Queue recipe saves when offline
2. **Push Notifications**: Meal reminders and updates
3. **Periodic Background Sync**: Update meal plans automatically
4. **Share Target API**: Share recipes from other apps
5. **File Handling**: Open recipe files directly in app
6. **Advanced Caching**: Implement custom strategies per route

### Implementation Considerations
- Background sync requires HTTPS
- Push notifications need user permission
- Periodic sync has browser support limitations
- Test thoroughly on target devices

---

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Deployment Guide](../Tasks/deployment.md) - Production deployment
- [Design System](./design_system.md) - UI/UX guidelines

---

## External Resources

- [Next PWA Documentation](https://github.com/shadowwalker/next-pwa)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Checklist](https://web.dev/pwa-checklist/)

---

**Last Updated:** 2026-01-18
**Maintained By:** Development Team
**Next Review:** When PWA features are enhanced or issues arise
