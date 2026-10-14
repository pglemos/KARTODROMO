const EARTH_RADIUS_METERS = 6_371_008.8;

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

export interface FinishLine {
  start: Pick<GpsPoint, 'latitude' | 'longitude'>;
  end: Pick<GpsPoint, 'latitude' | 'longitude'>;
  direction: 'positive' | 'negative';
}

type Vector = { x: number; y: number };

function cross(a: Vector, b: Vector) {
  return a.x * b.y - a.y * b.x;
}

function project(point: Pick<GpsPoint, 'latitude' | 'longitude'>, referenceLatitude: number): Vector {
  const radians = Math.PI / 180;
  return {
    x: EARTH_RADIUS_METERS * point.longitude * radians * Math.cos(referenceLatitude * radians),
    y: EARTH_RADIUS_METERS * point.latitude * radians,
  };
}

function validCoordinate(point: Pick<GpsPoint, 'latitude' | 'longitude'>) {
  return Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
}

export function findLineCrossingAt(
  previous: GpsPoint,
  current: GpsPoint,
  line: FinishLine,
  maxAccuracyMeters: number,
): number | null {
  if (!Number.isFinite(maxAccuracyMeters) || maxAccuracyMeters <= 0 ||
      !validCoordinate(previous) || !validCoordinate(current) || !validCoordinate(line.start) || !validCoordinate(line.end) ||
      !Number.isFinite(previous.timestamp) || !Number.isFinite(current.timestamp) || current.timestamp <= previous.timestamp ||
      !Number.isFinite(previous.accuracy) || !Number.isFinite(current.accuracy) ||
      previous.accuracy < 0 || current.accuracy < 0 ||
      previous.accuracy > maxAccuracyMeters || current.accuracy > maxAccuracyMeters) return null;

  const referenceLatitude = line.start.latitude;
  const p = project(previous, referenceLatitude);
  const p2 = project(current, referenceLatitude);
  const q = project(line.start, referenceLatitude);
  const q2 = project(line.end, referenceLatitude);
  const movement = { x: p2.x - p.x, y: p2.y - p.y };
  const finishLine = { x: q2.x - q.x, y: q2.y - q.y };
  const denominator = cross(movement, finishLine);
  if (Math.abs(denominator) < 1e-9) return null;

  const offset = { x: q.x - p.x, y: q.y - p.y };
  const movementRatio = cross(offset, finishLine) / denominator;
  const lineRatio = cross(offset, movement) / denominator;
  if (movementRatio < 0 || movementRatio > 1 || lineRatio < 0 || lineRatio > 1) return null;

  const previousSide = cross(finishLine, { x: p.x - q.x, y: p.y - q.y });
  const currentSide = cross(finishLine, { x: p2.x - q.x, y: p2.y - q.y });
  const correctDirection = line.direction === 'positive'
    ? previousSide < 0 && currentSide >= 0
    : previousSide > 0 && currentSide <= 0;
  if (!correctDirection) return null;

  return Math.round(previous.timestamp + movementRatio * (current.timestamp - previous.timestamp));
}
