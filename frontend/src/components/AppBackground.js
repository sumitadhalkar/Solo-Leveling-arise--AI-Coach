import heroBg from '../assets/hero-bg.jpg';

/**
 * Full-viewport background image, replacing the old three.js portal scene.
 * A static image with a dark readability overlay is dramatically cheaper than
 * a WebGL canvas — no GPU/driver crashes on low-end or mobile devices, no
 * three.js bundle weight, and no risk of a lost WebGL context breaking the UI.
 *
 * `isActive` (true while a strategy request is loading) drives a slow,
 * subtle zoom + brightening so the background still reads as "working"
 * without competing with the streaming text in the foreground.
 */
export default function AppBackground({ isActive }) {
  return (
    <div className="app-background" aria-hidden="true">
      <div
        className={`app-background-image${isActive ? ' is-active' : ''}`}
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="app-background-overlay" />
    </div>
  );
}
