# Post-Architecture Fixes Cleanup Checklist

## ✅ Completed
1. Removed dual relay pooling system - now using NPool directly
2. Standardized timeouts:
   - 5000ms for standard queries (comments)
   - 8000ms for heavy queries (courses, metadata, discovery)
3. Fixed infinite cache - changed from `Infinity` to 1 hour
4. Simplified `useDiscoverCourses` to use `nostr.query` directly

## 🗑️ Files That Can Be Removed

These files are now unused and can be safely deleted:

1. **src/lib/applesauceRelayAdapter.ts** - No longer used after removing adapter
2. **src/lib/eventStoreShim.ts** - No longer needed after simplifying useDiscoverCourses

### Optional: Consider removing if not used elsewhere
3. Check if these applesauce packages can be removed from package.json:
   - `applesauce-common`
   - `applesauce-core`
   - `applesauce-react`
   - `applesauce-relay`
   - `applesauce-signers`

## 🔧 Linting Errors to Fix

Run these fixes before next commit:

### 1. src/components/auth/EnhancedLoginDialog.tsx
Line 309: Remove unused 'err' variable or prefix with underscore

### 2. src/components/golf/CostSplitDialog.tsx
- Line 62: Remove or use 'rates' variable (or prefix with `_`)
- Line 100: Remove or use 'splits' variable (or prefix with `_`)
- Lines 543, 589, 591, 601: Replace `any` with proper types

### 3. If keeping applesauceRelayAdapter.ts for reference:
- Lines 69, 117: Replace `any` with proper types
- Line 111: Add comment or handling for empty catch block

## 📝 Next Steps

1. Delete unused files (applesauceRelayAdapter.ts, eventStoreShim.ts)
2. Fix ESLint errors listed above
3. Run `npm run test` to verify everything passes
4. Optional: Remove unused applesauce dependencies to reduce bundle size
5. Update ARCHITECTURE_AUDIT.md to mark recommendations as ✅ Complete

## 🎯 Bundle Size Impact

After removing unused files and dependencies, you should see:
- Smaller bundle size (applesauce packages are ~several hundred KB)
- Faster build times
- Simplified dependency tree
- Clearer codebase for future developers

## 📊 Verification Command

```bash
# Full test suite
npm run test

# Check bundle size
npm run build
# Look for "dist/index.html" file size

# Check if applesauce is still imported anywhere
npx grep -r "from.*applesauce" src/
```
