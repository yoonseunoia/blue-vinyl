# Blue Vinyl

A slow-travel recording app prototype. Each trip becomes an LP: moments are pinned onto the record while you travel, the LP is pressed when the journey ends, and it arrives a few days later to be played back.

**Live prototype:** https://yoonseunoia.github.io/blue-vinyl/

Open it on a phone for the full-screen experience. The capture screen asks for camera permission and records up to 15 seconds inside the circle.

## What's in the prototype

- Home: turntable, record stack, paper airplanes (LPs shared nearby)
- New LP: the sleeve (information) and the record (moments) split, then the record becomes the hub
- Capture: circular video viewfinder with a white progress ring (15 s limit)
- Moment edit: song picker, note, pin onto the LP
- Finish → choose cover → press → delivery (in transit / arrived / unboxing)
- Playback: one moment, or a chronological slideshow

## Files

```
index.html      page skeleton (fonts, phone frame, file inputs)
css/style.css   all styles, grouped by screen
js/app.js       state, screens and interactions
```

To change how something looks, edit `css/style.css`. To change what happens on a tap or swipe, edit `js/app.js`.
