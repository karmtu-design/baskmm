import { Background, type SpacingToken } from "@once-ui-system/core";
import { effects } from "@/resources/once-ui.config";

/** The page-wide decoration: dots and a gold glow from the top, behind everything else. */
export default function PageBackground() {
  return (
    <Background
      position="fixed"
      top="0"
      left="0"
      fill
      pointerEvents="none"
      zIndex={0}
      mask={{ x: 50, y: 0, radius: 100 }}
      dots={{
        display: effects.dots.display,
        opacity: effects.dots.opacity,
        size: effects.dots.size as SpacingToken,
        color: effects.dots.color,
      }}
      gradient={{
        display: effects.gradient.display,
        opacity: effects.gradient.opacity,
        x: effects.gradient.x,
        y: effects.gradient.y,
        width: effects.gradient.width,
        height: effects.gradient.height,
        tilt: effects.gradient.tilt,
        colorStart: effects.gradient.colorStart,
        colorEnd: effects.gradient.colorEnd,
      }}
    />
  );
}
