export interface Position {
  x: number;
  y: number;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
  top: number;
  left: number;
}

export function getSelectionCoordinates(): RectBounds | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    top: rect.top,
    left: rect.left,
  };
}

export function positionElementNear(
  element: HTMLElement,
  anchorRect: { top: number; bottom: number; left: number; width: number; height?: number },
  options: { offset?: number; preferBelow?: boolean } = {}
): void {
  const offset = options.offset || 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const elWidth = element.offsetWidth || 380;
  
  // Calculate available heights
  const spaceBelow = viewportHeight - anchorRect.bottom - offset - 16;
  const spaceAbove = anchorRect.top - offset - 16;

  // Decide whether to place above or below
  // If space below is less than 350px and space above is bigger, place above
  const placeAbove = spaceBelow < 340 && spaceAbove > spaceBelow;

  let maxAllowedHeight: number;
  let top: number;

  if (placeAbove) {
    maxAllowedHeight = Math.max(200, Math.min(520, spaceAbove));
    element.style.maxHeight = `${Math.round(maxAllowedHeight)}px`;
    
    // Read offsetHeight after setting maxHeight
    const actualHeight = element.offsetHeight || maxAllowedHeight;
    top = anchorRect.top - actualHeight - offset;
    if (top < 12) top = 12;
  } else {
    maxAllowedHeight = Math.max(200, Math.min(520, spaceBelow));
    element.style.maxHeight = `${Math.round(maxAllowedHeight)}px`;
    top = anchorRect.bottom + offset;
  }

  // Calculate left with margin constraints
  let left = anchorRect.left + anchorRect.width / 2 - elWidth / 2;
  if (left < 16) left = 16;
  if (left + elWidth > viewportWidth - 16) {
    left = viewportWidth - elWidth - 16;
  }

  element.style.position = "fixed";
  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
}
