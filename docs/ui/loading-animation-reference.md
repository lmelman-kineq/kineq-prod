# Kineq Loading Animation Reference

## Objective

Create a brief startup animation for Kineq that feels modern, precise and technological, while remaining appropriate for a healthcare management platform.

The visual direction may be inspired by circular futuristic interfaces, but it must not copy Jarvis, Iron Man interfaces or any third-party design.

The result should feel like:

> Modern healthcare technology, not a videogame or military interface.

---

## Brand asset

Use the Kineq isologo as the central element.

Expected asset location:

```text
frontend/src/assets/branding/kineq-isologo.svg
```

Recommended optional fallback:

```text
frontend/src/assets/branding/kineq-isologo.png
```

The SVG should:

- Have a transparent background.
- Contain only the circular isologo and the internal K symbol.
- Preserve the original proportions.
- Avoid raster effects.
- Prefer separate elements for the outer circle and internal symbol.
- Allow its color to be controlled from CSS when possible.
- Use `currentColor`, CSS variables or clearly identifiable SVG fills/strokes when practical.

Suggested internal IDs, if the SVG is manually cleaned:

```xml
<circle id="kineq-logo-ring" />
<path id="kineq-logo-symbol" />
```

Claude Code must inspect the actual SVG before relying on these IDs.

---

## Color palette

The following palette is derived from the current Kineq isologo and can be used as the initial official loading-animation palette.

```css
--kineq-violet-50:  #F5F1FF;
--kineq-violet-100: #E9DFFF;
--kineq-violet-200: #D2BEFA;
--kineq-violet-300: #B89EF1;
--kineq-violet-400: #9976ED;
--kineq-violet-500: #7D52E8;
--kineq-violet-600: #602DE6;
--kineq-violet-700: #5622E3;
--kineq-violet-800: #4520B8;
--kineq-violet-900: #311675;
```

Primary brand reference:

```css
--kineq-primary: #602DE6;
```

Supporting loading colors:

```css
--kineq-loading-background: #09090F;
--kineq-loading-surface: #11111A;
--kineq-loading-text: #F7F5FF;
--kineq-loading-muted: #B8B2C8;
--kineq-loading-glow: rgba(96, 45, 230, 0.42);
--kineq-loading-glow-strong: rgba(125, 82, 232, 0.62);
```

Do not hardcode these values repeatedly. Reuse existing theme tokens if equivalent variables already exist in the project.

---

## Animation composition

Place the Kineq isologo at the center of the viewport.

Surround it with three circular animated rings:

### Outer ring

- Largest ring.
- Rotates clockwise.
- Slow and smooth movement.
- Uses segmented strokes.
- May include one brighter moving segment.
- Must remain subtle.

### Middle ring

- Rotates counterclockwise.
- Slightly faster than the outer ring.
- Uses partial arcs rather than a complete solid circle.
- Can use a lighter Kineq violet.

### Inner ring

- Closest to the logo.
- Does not need continuous rotation.
- Uses a subtle pulse, opacity change or light expansion.
- Helps visually connect the rings with the logo.

### Central logo

- Appears through opacity and gentle scale.
- Starts slightly smaller, for example around `0.92`.
- Finishes at its natural scale.
- May have a restrained violet glow.
- Must remain sharp and readable.
- Must not rotate.

---

## Loading text

Use exactly:

```text
Preparando Kineq
```

Presentation:

- Centered below the isologo.
- Small or medium text.
- Moderate letter spacing.
- High readability.
- No fake technical messages.
- Optional animated ellipsis is allowed if subtle.
- Do not cycle through multiple messages in the first implementation.

---

## Duration and behavior

Recommended minimum visible duration:

```text
1.4 seconds
```

Acceptable total range:

```text
1.2 to 1.8 seconds
```

Behavior:

- Show during the initial application startup.
- Connect it to the real application initialization state.
- It may cover authentication restoration and initial user/workspace loading.
- Do not show it during normal internal navigation.
- Do not artificially delay the application beyond the minimum visual duration.
- If initialization takes longer, keep the rings moving until ready.
- When initialization finishes, perform a short fade-out and optional slight scale transition.
- Remove the loading screen from interaction and accessibility flow after completion.

Suggested conceptual rule:

```tsx
showBootScreen = appIsInitializing || !minimumAnimationTimeCompleted
```

Claude Code must adapt this to the actual application architecture.

---

## Background

Use a dark startup background for the first implementation:

```css
background: #09090F;
```

A very subtle radial gradient may be used around the logo:

```css
background:
  radial-gradient(
    circle at center,
    rgba(96, 45, 230, 0.12) 0%,
    rgba(9, 9, 15, 0) 45%
  ),
  #09090F;
```

Requirements:

- Avoid visible banding.
- Avoid bright blue or cyan as the dominant color.
- Do not imitate the Jarvis color palette.
- Violet must remain the main highlight.
- Avoid large particle systems in the first version.

---

## Technical direction

Preferred implementation:

```text
React + SVG + CSS animations
```

Use an animation library only if the repository already has one or if there is a clear reusable product-wide reason.

Priorities:

- Lightweight.
- Responsive.
- Sharp at every resolution.
- Easy to maintain.
- Compatible with the current Kineq visual system.
- No video.
- No GIF.
- No audio.
- No canvas particle engine.
- No 3D dependency.

Claude Code must inspect the repository before selecting:

- CSS Modules.
- Global CSS.
- Tailwind.
- Styled components.
- Framer Motion.
- Another existing animation approach.

Do not add a large dependency only for this screen.

---

## Responsive behavior

The animation must work on desktop, tablet and mobile.

Suggested sizing:

```css
width: clamp(180px, 28vw, 360px);
```

The rings should scale together as one composition.

Avoid:

- Content clipping.
- Fixed pixel layouts that break on mobile.
- Text placed too close to the bottom edge.
- Extremely thin strokes that disappear on high-density displays.

---

## Accessibility

Respect reduced-motion preferences.

For:

```css
@media (prefers-reduced-motion: reduce)
```

Use:

- No continuous rotation, or a substantially reduced movement.
- Simple opacity transition.
- Static rings.
- No pulsing glow.
- The same loading message.

The loading screen should expose a sensible status to assistive technologies, for example:

```text
Preparando Kineq
```

Do not announce decorative ring details.

---

## Performance requirements

- Prefer transforms and opacity for animation.
- Avoid layout-triggering animation properties.
- Avoid continuous heavy filters.
- Keep blur and glow effects restrained.
- Do not block the main thread.
- Do not load remote assets.
- Do not introduce a video request before the app can start.
- Use the local SVG asset.
- Confirm that the animation remains smooth on an average laptop and mobile device.

---

## Visual constraints

The animation should be:

- Elegant.
- Minimal.
- Technological.
- Calm.
- Precise.
- Consistent with a healthcare platform.
- Recognizably Kineq.

It should not be:

- Aggressive.
- Noisy.
- Excessively bright.
- Full of fake data.
- Similar to a videogame HUD.
- A direct Jarvis recreation.
- Longer than necessary.
- Repeated on every page change.

---

## Suggested sequence

A possible sequence is:

1. Dark background fades in.
2. Outer ring appears and begins rotating.
3. Middle ring appears in the opposite direction.
4. Inner ring pulses once.
5. Kineq isologo fades and scales into place.
6. Text `Preparando Kineq` appears.
7. Application initialization completes.
8. Rings align or reduce opacity.
9. Full loading layer fades out.
10. The main Kineq interface becomes interactive.

This sequence is a direction, not a rigid implementation contract. Claude Code should adapt it to the existing application structure.

---

## Acceptance criteria

The implementation is accepted when:

- The Kineq SVG is used as the central asset.
- Violet `#602DE6` or the equivalent existing Kineq token is the main highlight.
- Three visually distinct circular layers are present.
- At least two rings move in opposite directions.
- The central logo does not rotate.
- The text says `Preparando Kineq`.
- The screen remains visible for approximately 1.4 seconds minimum.
- It disappears as soon as both initialization and minimum duration are complete.
- It does not appear during normal internal route changes.
- It works in desktop and mobile layouts.
- It respects `prefers-reduced-motion`.
- It does not use video, GIF or audio.
- It does not introduce an unnecessary large dependency.
- It preserves the existing Kineq UI after the transition.
