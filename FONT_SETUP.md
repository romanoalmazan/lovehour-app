# Cinnamon Cake Font Setup

## Current Status
- ✅ Font loading infrastructure set up in `App.tsx`
- ✅ Font added to `app.json`
- ✅ Font partially applied to some screens
- ❌ **Font file missing** - You need to add `CinnamonCake.ttf` to `assets/fonts/` directory
- ⚠️ Font needs to be added to all text styles across all screens

## Steps to Complete Setup

### 1. Add the Font File
1. Download or obtain the Cinnamon Cake font file (`.ttf` or `.otf` format)
2. Place it in `assets/fonts/` directory
3. Name it exactly `CinnamonCake.ttf` (or update the require path in `App.tsx` if different)

### 2. Verify Font Loading
After adding the font file, check the console logs when the app starts. You should see:
- "Cinnamon Cake font loaded successfully" - if successful
- Error message - if the file is missing or incorrectly named

### 3. Apply Font to All Text Styles
The font needs to be added to all text-related styles. Add `fontFamily: 'CinnamonCake',` to any style object that has:
- `fontSize`
- `fontWeight`
- `color` (for text)

Example:
```typescript
title: {
  fontSize: 42,
  fontWeight: 'bold',
  color: '#8B6F47',
  fontFamily: 'CinnamonCake', // Add this line
},
```

### 4. Screens That Need Font Updates
- ✅ NotepadScreen.tsx - COMPLETE
- ✅ AuthScreen.tsx - COMPLETE
- ⚠️ LoveHourScreen.tsx - PARTIAL (needs more styles)
- ❌ HomeScreen.tsx - NEEDS UPDATE
- ❌ ChoosePartnerScreen.tsx - NEEDS UPDATE
- ❌ ProfileScreen.tsx - NEEDS UPDATE
- ❌ UserProfileSetupScreen.tsx - NEEDS UPDATE
- ❌ TermsOfServiceScreen.tsx - NEEDS UPDATE

## Troubleshooting

If the font still doesn't appear:
1. Check that the font file exists in `assets/fonts/CinnamonCake.ttf`
2. Check console for font loading errors
3. Verify the font name matches exactly (case-sensitive)
4. Try restarting the Expo development server
5. Clear cache: `expo start -c`

