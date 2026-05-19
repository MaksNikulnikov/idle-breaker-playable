import { Color, Graphics, Vec3 } from 'cc';

export function drawDashedZone(
  graphics: Graphics,
  zoneWidth: number,
  zoneHeight: number,
  zoneRadius: number,
  zoneDashLength: number,
  zoneGapLength: number,
): void {
  graphics.clear();
  graphics.lineWidth = 5;
  graphics.strokeColor = new Color(255, 255, 255, 230);
  graphics.fillColor = new Color(255, 255, 255, 18);

  const width = Math.max(40, zoneWidth);
  const height = Math.max(40, zoneHeight);
  const radius = Math.max(0, Math.min(zoneRadius, width / 2, height / 2));
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;

  graphics.roundRect(left, bottom, width, height, radius);
  graphics.fill();

  const points = createRoundedRectPoints(left, right, top, bottom, radius);
  drawDashedPolyline(graphics, points, true, zoneDashLength, zoneGapLength);
}

function createRoundedRectPoints(
  left: number,
  right: number,
  top: number,
  bottom: number,
  radius: number,
): Vec3[] {
  const points: Vec3[] = [];
  const segmentsPerCorner = 8;

  appendLinePoints(points, left + radius, top, right - radius, top, 8);
  appendArcPoints(points, right - radius, top - radius, radius, 90, 0, segmentsPerCorner);
  appendLinePoints(points, right, top - radius, right, bottom + radius, 8);
  appendArcPoints(points, right - radius, bottom + radius, radius, 0, -90, segmentsPerCorner);
  appendLinePoints(points, right - radius, bottom, left + radius, bottom, 8);
  appendArcPoints(points, left + radius, bottom + radius, radius, -90, -180, segmentsPerCorner);
  appendLinePoints(points, left, bottom + radius, left, top - radius, 8);
  appendArcPoints(points, left + radius, top - radius, radius, 180, 90, segmentsPerCorner);

  return points;
}

function appendLinePoints(
  points: Vec3[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number,
): void {
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    points.push(new Vec3(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0));
  }
}

function appendArcPoints(
  points: Vec3[],
  centerX: number,
  centerY: number,
  radius: number,
  fromDegrees: number,
  toDegrees: number,
  segments: number,
): void {
  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const radians = ((fromDegrees + (toDegrees - fromDegrees) * t) * Math.PI) / 180;
    points.push(
      new Vec3(centerX + Math.cos(radians) * radius, centerY + Math.sin(radians) * radius, 0),
    );
  }
}

function drawDashedPolyline(
  graphics: Graphics,
  points: Vec3[],
  closed: boolean,
  zoneDashLength: number,
  zoneGapLength: number,
): void {
  if (points.length < 2) {
    return;
  }

  let drawing = true;
  const dashLength = Math.max(1, zoneDashLength);
  const gapLength = Math.max(1, zoneGapLength);
  let remaining = dashLength;

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];

    if (!closed && index === points.length - 1) {
      break;
    }

    let segmentStartX = start.x;
    let segmentStartY = start.y;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    let segmentRemaining = Math.hypot(deltaX, deltaY);

    if (segmentRemaining <= 0.001) {
      continue;
    }

    const directionX = deltaX / segmentRemaining;
    const directionY = deltaY / segmentRemaining;

    while (segmentRemaining > 0.001) {
      const step = Math.min(remaining, segmentRemaining);
      const segmentEndX = segmentStartX + directionX * step;
      const segmentEndY = segmentStartY + directionY * step;

      if (drawing) {
        graphics.moveTo(segmentStartX, segmentStartY);
        graphics.lineTo(segmentEndX, segmentEndY);
      }

      segmentStartX = segmentEndX;
      segmentStartY = segmentEndY;
      segmentRemaining -= step;
      remaining -= step;

      if (remaining <= 0.001) {
        drawing = !drawing;
        remaining = drawing ? dashLength : gapLength;
      }
    }
  }

  graphics.stroke();
}
