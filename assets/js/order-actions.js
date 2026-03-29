/**
 * order-actions.js — Role-based order action buttons
 *
 * Import in any dashboard:
 *   import { getOrderActions, STATUS_LABELS, renderActionButtons } from './order-actions.js';
 *
 * Call the unified endpoint:
 *   POST /api/orders/update-status
 *   Body: { order_id, new_status }
 *   Header: Authorization: Bearer <token>
 */

// ─── Status labels (Arabic) ───────────────────────────────────────────────────
export const STATUS_LABELS = {
  pending:            'معلّق',
  confirmed:          'مؤكّد',
  rejected:           'مرفوض',
  ready_for_shipping: 'جاهز للشحن',
  out_for_delivery:   'في التوصيل',
  delivered:          'تم التسليم',
};

/**
 * Returns the available action buttons for an order given the caller's role.
 *
 * @param {{ id: string, status: string, driver_id: string|null }} order
 * @param {'trader'|'delivery'|'admin'} role  — server-resolved role
 * @param {string|null} currentUserId         — authenticated user's UUID
 * @returns {{ to: string, label: string, cls: string }[]}
 */
export function getOrderActions(order, role, currentUserId = null) {
  const s = order.status;

  if (role === 'trader') {
    if (s === 'pending') {
      return [
        { to: 'confirmed',  label: '✔ تأكيد الطلب',    cls: 'oa-btn-confirm' },
        { to: 'rejected',   label: '✖ رفض الطلب',       cls: 'oa-btn-danger'  },
      ];
    }
    if (s === 'confirmed') {
      return [
        { to: 'ready_for_shipping', label: '📦 جاهز للشحن', cls: 'oa-btn-warn' },
      ];
    }
    return [];
  }

  if (role === 'delivery') {
    // Available order: no driver yet — driver can claim it
    if (s === 'ready_for_shipping' && !order.driver_id) {
      return [
        { to: 'out_for_delivery', label: '🚗 بدء التوصيل', cls: 'oa-btn-start' },
      ];
    }
    // Driver's own active order
    if (s === 'out_for_delivery' && order.driver_id === currentUserId) {
      return [
        { to: 'delivered', label: '✅ تم التسليم', cls: 'oa-btn-done' },
      ];
    }
    return [];
  }

  if (role === 'admin') {
    const allStatuses = Object.keys(STATUS_LABELS);
    return allStatuses
      .filter(x => x !== s)
      .map(x => ({ to: x, label: STATUS_LABELS[x], cls: 'oa-btn-admin' }));
  }

  return [];
}

/**
 * Renders action <button> elements into `containerEl`.
 * Each button calls `onAction(newStatus, buttonEl)` when clicked.
 *
 * @param {HTMLElement} containerEl
 * @param {{ id: string, status: string, driver_id: string|null }} order
 * @param {'trader'|'delivery'|'admin'} role
 * @param {string|null} currentUserId
 * @param {(newStatus: string, btn: HTMLButtonElement) => void} onAction
 */
export function renderActionButtons(containerEl, order, role, currentUserId, onAction) {
  const actions = getOrderActions(order, role, currentUserId);
  containerEl.innerHTML = '';

  if (!actions.length) return;

  actions.forEach(({ to, label, cls }) => {
    const btn = document.createElement('button');
    btn.className = `oa-btn ${cls}`;
    btn.textContent = label;
    btn.dataset.to = to;
    btn.addEventListener('click', () => onAction(to, btn));
    containerEl.appendChild(btn);
  });
}

/**
 * Sends a status update to the unified endpoint.
 *
 * @param {string} orderId
 * @param {string} newStatus
 * @param {string} token  — JWT access token
 * @returns {Promise<{ ok: boolean, data: object }>}
 */
export async function updateOrderStatus(orderId, newStatus, token) {
  const res = await fetch('/api/orders/update-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ order_id: orderId, new_status: newStatus }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
