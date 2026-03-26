const GEOFENCE_CENTER = { lat: 22.796495, lng: 58.150668 };
const GEOFENCE_RADIUS_KM = 3.5;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function validateLatLng(lat, lng) {
  if (lat < -90 || lat > 90) {
    return 'LATITUDE_OUT_OF_RANGE';
  }
  if (lng < -180 || lng > 180) {
    return 'LONGITUDE_OUT_OF_RANGE';
  }
  return null;
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Use POST /api/validate-location'
    });
  }

  const lat = toNumber(req.body?.latitude);
  const lng = toNumber(req.body?.longitude);

  if (lat === null || lng === null) {
    return res.status(400).json({
      error: 'INVALID_PAYLOAD',
      message: 'latitude and longitude must be valid numbers'
    });
  }

  const rangeError = validateLatLng(lat, lng);
  if (rangeError) {
    return res.status(400).json({
      error: rangeError,
      message: 'Latitude/longitude out of valid range'
    });
  }

  const distanceKm = haversineKm(lat, lng, GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng);
  const eligible = distanceKm <= GEOFENCE_RADIUS_KM;

  return res.status(200).json({
    eligible,
    distanceKm,
    radiusKm: GEOFENCE_RADIUS_KM,
    center: GEOFENCE_CENTER,
    reason: eligible ? null : 'OUTSIDE_SERVICE_AREA'
  });
}
