# Assets Directory

This directory contains all front-end assets used by the Twitch overlay system.

## Directory Structure

```
assets/
├── img/          # Images for commands and events
├── audio/        # Sound effects and audio clips
├── video/        # Video files (if needed)
└── README.md     # This file
```

## Missing Assets

Based on the current command configuration, you need to add these files:

### Images (assets/img/)
- `lurk.png` - Image displayed when someone uses the `!lurk` command

### Audio (assets/audio/)
- `lurk.mp3` - Sound played when someone uses the `!lurk` command

## Adding New Assets

When adding new commands in `backend/config/commands.js`, make sure to:

1. **Images**: Place image files in `assets/img/`
   - Supported formats: PNG, JPG, GIF, WebP
   - Recommended max size: 800x600px for good overlay performance
   - Use descriptive filenames matching your command names

2. **Audio**: Place audio files in `assets/audio/`
   - Supported formats: MP3, WAV, OGG
   - Keep files under 5MB for fast loading
   - Consider volume levels (overlay plays at 50% by default)

3. **Video**: Place video files in `assets/video/` (if you add video support later)
   - Supported formats: MP4, WebM
   - Keep files under 10MB for streaming performance

## File Naming Convention

- Use lowercase with hyphens for multi-word files: `my-command.png`
- Match the filenames exactly as specified in your command configs
- Avoid spaces and special characters in filenames

## Testing Assets

To test if assets load correctly:
1. Start your backend server (`npm run start`)
2. Open the overlay in OBS or a browser: `overlay/index.html`
3. Trigger commands in Twitch chat to see if images/sounds load properly
4. Check browser console for any missing asset warnings