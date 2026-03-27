import { adminClient, json, normalizeString, requireAuth } from './_supabase-admin.js';

const SERVICE_CENTER = { lat: 22.796495, lng: 58.150668 };
const SERVICE_RADIUS_KM = 1;

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

function toBool(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'نعم'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'لا'].includes(normalized)) return false;
  }
  return null;
}

function requireLen(value, max, label, min = 1) {
  const normalized = normalizeString(value);
  if (normalized.length < min) {
    return { error: `${label}_REQUIRED` };
  }
  if (normalized.length > max) {
    return { error: `${label}_TOO_LONG` };
  }
  return { value: normalized };
}

function looksLikeGoogleMapsUrl(value) {
  const raw = normalizeString(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    return host.includes('google.com') || host.includes('goo.gl') || host.includes('maps.app.goo.gl');
  } catch {
    return false;
  }
}

function validateTraderFields(payload) {
  const storeName = requireLen(payload.storeName, 120, 'STORE_NAME');
  if (storeName.error) return { error: storeName.error, message: 'اسم المتجر مطلوب.' };

  const ownerName = requireLen(payload.ownerName, 120, 'OWNER_NAME');
  if (ownerName.error) return { error: ownerName.error, message: 'اسم المالك مطلوب.' };

  const commercialRegistration = requireLen(payload.commercialRegistration, 60, 'COMMERCIAL_REGISTRATION');
  if (commercialRegistration.error) {
    return { error: commercialRegistration.error, message: 'السجل التجاري مطلوب.' };
  }

  const phone = requireLen(payload.whatsappPhone, 30, 'WHATSAPP_PHONE');
  if (phone.error) return { error: phone.error, message: 'رقم الواتساب مطلوب.' };

  const email = requireLen(payload.email, 160, 'EMAIL');
  if (email.error || !/^\S+@\S+\.\S+$/.test(email.value)) {
    return { error: 'INVALID_EMAIL', message: 'البريد الإلكتروني غير صالح.' };
  }

  const mapLink = requireLen(payload.googleMapsLink, 400, 'MAP_LINK');
  if (mapLink.error || !looksLikeGoogleMapsUrl(mapLink.value)) {
    return { error: 'INVALID_MAP_LINK', message: 'رابط خرائط Google غير صالح.' };
  }

  const needsHelp = toBool(payload.needsProductEntryHelp);
  if (needsHelp === null) {
    return { error: 'INVALID_HELP_FLAG', message: 'حدد هل تحتاج مساعدة في إدخال المنتجات.' };
  }

  return {
    value: {
      storeName: storeName.value,
      ownerName: ownerName.value,
      commercialRegistration: commercialRegistration.value,
      whatsappPhone: phone.value,
      email: email.value,
      googleMapsLink: mapLink.value,
      needsProductEntryHelp: needsHelp
    }
  };
}

function validateDeliveryFields(payload) {
  const fullName = requireLen(payload.fullName, 120, 'FULL_NAME');
  if (fullName.error) return { error: fullName.error, message: 'الاسم الكامل مطلوب.' };

  const phone = requireLen(payload.phone, 30, 'PHONE');
  if (phone.error) return { error: phone.error, message: 'رقم الهاتف مطلوب.' };

  const email = requireLen(payload.email, 160, 'EMAIL');
  if (email.error || !/^\S+@\S+\.\S+$/.test(email.value)) {
    return { error: 'INVALID_EMAIL', message: 'البريد الإلكتروني غير صالح.' };
  }

  const isAvailable = toBool(payload.isAvailable);
  if (isAvailable === null) {
    return { error: 'INVALID_AVAILABILITY', message: 'حدد هل أنت متفرغ.' };
  }

  const knowsArea = toBool(payload.knowsArea);
  if (knowsArea === null) {
    return { error: 'INVALID_AREA_KNOWLEDGE', message: 'حدد معرفتك بالمنطقة.' };
  }

  const canPeakHours = toBool(payload.canPeakHours);
  if (canPeakHours === null) {
    return { error: 'INVALID_PEAK_HOURS', message: 'حدد قدرتك على العمل في أوقات الذروة.' };
  }

  const declaration = payload.declaration || {};
  const isOmani = toBool(declaration.isOmani) === true;
  const over18 = toBool(declaration.over18) === true;
  const hasVehicle = toBool(declaration.hasVehicle) === true;
  const committed = toBool(declaration.committed) === true;
  const fromAlMaamoura = toBool(declaration.fromAlMaamoura) === true;

  if (!(isOmani && over18 && hasVehicle && committed && fromAlMaamoura)) {
    return {
      error: 'STRICT_CONDITIONS_NOT_MET',
      message: 'يجب استيفاء الشروط الأساسية (الجنسية، العمر، وسيلة نقل، التفرغ، السكن في المعمورة).'
    };
  }

  const availabilitySchedule = normalizeString(payload.availabilitySchedule);
  if (availabilitySchedule.length > 300) {
    return { error: 'AVAILABILITY_SCHEDULE_TOO_LONG', message: 'تفاصيل أوقات التفرغ طويلة جدًا.' };
  }

  return {
    value: {
      fullName: fullName.value,
      phone: phone.value,
      email: email.value,
      isAvailable,
      availabilitySchedule,
      knowsArea,
      canPeakHours,
      declaration: {
        isOmani,
        over18,
        hasVehicle,
        committed,
        fromAlMaamoura
      }
    }
  };
}

function parseRequestedRole(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'trader' || normalized === 'delivery' ? normalized : '';
}

async function getProfile(userId) {
  const { data, error } = await adminClient
    .from('user_profiles')
    .select(
      'user_id, role, account_status, latitude, longitude, location_validated, requested_role, application_status, application_payload, application_submitted_at, application_reviewed_at, application_reviewed_by, application_rejection_reason'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function buildApplicationSummary(profile) {
  return {
    requested_role: profile?.requested_role || null,
    application_status: profile?.application_status || 'none',
    application_payload: profile?.application_payload || null,
    application_submitted_at: profile?.application_submitted_at || null,
    application_reviewed_at: profile?.application_reviewed_at || null,
    application_reviewed_by: profile?.application_reviewed_by || null,
    application_rejection_reason: profile?.application_rejection_reason || null
  };
}

async function handleGet(req, res, auth) {
  try {
    const profile = await getProfile(auth.user.id);
    return json(res, 200, {
      role: profile?.role || 'user',
      account_status: profile?.account_status || 'active',
      application: buildApplicationSummary(profile)
    });
  } catch (error) {
    return json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: error.message });
  }
}

async function handlePost(req, res, auth) {
  const requestedRole = parseRequestedRole(req.body?.requestedRole);
  if (!requestedRole) {
    return json(res, 400, { error: 'INVALID_ROLE_REQUEST', message: 'requestedRole must be trader or delivery' });
  }

  let profile;
  try {
    profile = await getProfile(auth.user.id);
  } catch (error) {
    return json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: error.message });
  }

  if (!profile) {
    return json(res, 400, { error: 'PROFILE_REQUIRED', message: 'يرجى إكمال ملف الحساب أولاً.' });
  }

  const accountStatus = profile.account_status || 'active';
  if (accountStatus === 'banned') {
    return json(res, 403, { error: 'ACCOUNT_BANNED', message: 'الحساب محظور.' });
  }

  if ((profile.role || 'user') !== 'user') {
    return json(res, 409, {
      error: 'ROLE_ALREADY_ASSIGNED',
      message: `لا يمكن إرسال الطلب لأن الدور الحالي هو ${(profile.role || 'user')}.`
    });
  }

  if ((profile.application_status || 'none') === 'pending') {
    return json(res, 409, { error: 'PENDING_EXISTS', message: 'لديك طلب قيد المراجعة بالفعل.' });
  }

  if (!profile.location_validated) {
    return json(res, 400, { error: 'LOCATION_VALIDATION_REQUIRED', message: 'يجب التحقق من الموقع من صفحة الحساب.' });
  }

  const lat = Number(profile.latitude);
  const lng = Number(profile.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json(res, 400, { error: 'LOCATION_COORDS_REQUIRED', message: 'إحداثيات الموقع غير مكتملة في الحساب.' });
  }

  const distanceKm = haversineKm(lat, lng, SERVICE_CENTER.lat, SERVICE_CENTER.lng);
  if (distanceKm > SERVICE_RADIUS_KM) {
    return json(res, 400, {
      error: 'OUTSIDE_SERVICE_AREA',
      message: 'الموقع خارج نطاق الخدمة. حدّث موقعك من صفحة الحساب.',
      distanceKm
    });
  }

  const rolePayload = req.body?.application || {};
  const validation =
    requestedRole === 'trader' ? validateTraderFields(rolePayload) : validateDeliveryFields(rolePayload);

  if (validation.error) {
    return json(res, 400, validation);
  }

  const now = new Date().toISOString();
  const updatePayload = {
    user_id: auth.user.id,
    requested_role: requestedRole,
    application_status: 'pending',
    application_payload: validation.value,
    application_submitted_at: now,
    application_reviewed_at: null,
    application_reviewed_by: null,
    application_rejection_reason: null,
    updated_at: now
  };

  const { data, error } = await adminClient
    .from('user_profiles')
    .upsert(updatePayload, { onConflict: 'user_id' })
    .select(
      'user_id, role, requested_role, application_status, application_payload, application_submitted_at, application_reviewed_at, application_reviewed_by, application_rejection_reason'
    )
    .single();

  if (error) {
    return json(res, 500, { error: 'APPLICATION_SAVE_FAILED', message: error.message });
  }

  return json(res, 201, {
    message: 'تم إرسال الطلب بنجاح وهو الآن قيد المراجعة.',
    application: buildApplicationSummary(data)
  });
}

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (req.method === 'GET') {
    return handleGet(req, res, auth);
  }

  if (req.method === 'POST') {
    return handlePost(req, res, auth);
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST' });
}