/**
 * جوب البلاد — Form Validation
 * Returns { valid: boolean, message: string } for each check.
 * All messages are in Arabic.
 */

const Validation = {

  // ================================================================
  // Individual field validators
  // ================================================================

  name(value) {
    const v = (value || '').trim();
    if (!v)           return { valid: false, message: 'الاسم مطلوب' };
    if (v.length < 2) return { valid: false, message: 'الاسم قصير جداً' };
    if (v.length > 100) return { valid: false, message: 'الاسم طويل جداً' };
    return { valid: true };
  },

  email(value) {
    const v = (value || '').trim().toLowerCase();
    if (!v) return { valid: false, message: 'البريد الإلكتروني مطلوب' };
    // RFC 5322 simplified
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(v)) return { valid: false, message: 'البريد الإلكتروني غير صحيح' };
    return { valid: true };
  },

  /**
   * Omani phone: 8 digits starting with 7, 9, or 2 (optionally prefixed with 968 or 0).
   */
  phone(value) {
    const v = (value || '').replace(/\s/g, '');
    if (!v) return { valid: false, message: 'رقم الهاتف مطلوب' };
    const digits = v.replace(/\D/g, '');
    const local  = digits.startsWith('968') ? digits.slice(3)
                 : digits.startsWith('0')   ? digits.slice(1)
                 : digits;
    if (local.length !== 8)        return { valid: false, message: 'رقم الهاتف يجب أن يكون 8 أرقام' };
    if (!/^[279]/.test(local))     return { valid: false, message: 'رقم الهاتف غير صحيح' };
    return { valid: true };
  },

  password(value) {
    if (!value)            return { valid: false, message: 'كلمة المرور مطلوبة' };
    if (value.length < 8)  return { valid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
    if (!/[a-z]/.test(value)) return { valid: false, message: 'كلمة المرور يجب أن تحتوي على حرف صغير على الأقل' };
    if (!/[A-Z]/.test(value)) return { valid: false, message: 'كلمة المرور يجب أن تحتوي على حرف كبير على الأقل' };
    if (!/[0-9]/.test(value)) return { valid: false, message: 'كلمة المرور يجب أن تحتوي على رقم على الأقل' };
    if (!/[^a-zA-Z0-9]/.test(value)) return { valid: false, message: 'كلمة المرور يجب أن تحتوي على رمز خاص على الأقل' };
    return { valid: true };
  },

  /**
   * Returns the status of each individual password requirement.
   * Useful for building live requirement checklists.
   * @param {string} value
   * @returns {{ length: boolean, lower: boolean, upper: boolean, digit: boolean, symbol: boolean }}
   */
  passwordRequirements(value) {
    const v = value || '';
    return {
      length: v.length >= 8,
      lower:  /[a-z]/.test(v),
      upper:  /[A-Z]/.test(v),
      digit:  /[0-9]/.test(v),
      symbol: /[^a-zA-Z0-9]/.test(v),
    };
  },

  passwordConfirm(password, confirm) {
    if (!confirm)             return { valid: false, message: 'تأكيد كلمة المرور مطلوب' };
    if (password !== confirm) return { valid: false, message: 'كلمة المرور غير متطابقة' };
    return { valid: true };
  },

  price(value) {
    const n = parseFloat(value);
    if (isNaN(n) || value === '') return { valid: false, message: 'السعر مطلوب' };
    if (n < 0)                    return { valid: false, message: 'السعر لا يمكن أن يكون سالباً' };
    if (n > 999)                  return { valid: false, message: 'السعر مرتفع جداً' };
    return { valid: true };
  },

  quantity(value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || value === '') return { valid: false, message: 'الكمية مطلوبة' };
    if (n < 1)                    return { valid: false, message: 'الكمية يجب أن تكون 1 على الأقل' };
    if (n > 99)                   return { valid: false, message: 'الكمية مرتفعة جداً' };
    return { valid: true };
  },

  /**
   * Google Maps share link or coordinate format.
   */
  locationLink(value) {
    const v = (value || '').trim();
    if (!v) return { valid: false, message: 'رابط الموقع مطلوب' };
    // Accept maps.google.com, goo.gl, plus.codes, or lat,lng
    const ok =
      v.includes('maps.google') ||
      v.includes('goo.gl/maps') ||
      v.includes('maps.app.goo.gl') ||
      v.includes('plus.codes') ||
      /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(v);
    if (!ok) return { valid: false, message: 'يرجى لصق رابط موقع Google Maps' };
    return { valid: true };
  },

  storeName(value) {
    const v = (value || '').trim();
    if (!v)            return { valid: false, message: 'اسم المتجر مطلوب' };
    if (v.length < 2)  return { valid: false, message: 'اسم المتجر قصير جداً' };
    if (v.length > 80) return { valid: false, message: 'اسم المتجر طويل جداً' };
    return { valid: true };
  },

  productName(value) {
    const v = (value || '').trim();
    if (!v)            return { valid: false, message: 'اسم المنتج مطلوب' };
    if (v.length > 100) return { valid: false, message: 'اسم المنتج طويل جداً' };
    return { valid: true };
  },

  // ================================================================
  // Form-level validation helpers
  // ================================================================

  /**
   * Validate a form field and show/clear the error message.
   * The error element must have id = `${inputEl.id}_error`.
   * @param {HTMLInputElement} inputEl
   * @param {Function} validatorFn — one of Validation.xxx
   * @param {...any} extraArgs — for validators that need a second parameter
   * @returns {boolean}
   */
  field(inputEl, validatorFn, ...extraArgs) {
    const result   = validatorFn(inputEl.value, ...extraArgs);
    const errorEl  = document.getElementById(`${inputEl.id}_error`);
    if (errorEl) {
      errorEl.textContent = result.valid ? '' : result.message;
      errorEl.style.display = result.valid ? 'none' : 'block';
    }
    inputEl.classList.toggle('input-error', !result.valid);
    return result.valid;
  },

  /**
   * Show an error message for an element.
   * @param {string} elementId
   * @param {string} message
   */
  showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent    = message;
    el.style.display  = 'block';
  },

  clearError(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent   = '';
    el.style.display = 'none';
  },

};
