/**
 * Themed banner image at the top of a page's sidebar — gives Analyze Team
 * and Pull Advisor a distinct visual identity instead of sharing the same
 * generic layout. Bleeds to the sidebar's edges (see .sidebar-hero in
 * App.css) and fades into the panel background at the bottom.
 */
export default function SidebarHero({ image, theme }) {
  return (
    <div
      className={`sidebar-hero ${theme}`}
      style={{ backgroundImage: `url(${image})` }}
      aria-hidden="true"
    />
  );
}
