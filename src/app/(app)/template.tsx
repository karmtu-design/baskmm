import { ViewTransition } from "react";

// A template mounts anew on every navigation, so each page enters and leaves with the animation
// defined in globals.css (.page-in / .page-out). The header stays still: it has its own transition name.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
