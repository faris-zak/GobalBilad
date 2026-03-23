# GobalBilad 🛒
**Local food delivery platform for Oman — Orders via WhatsApp**

---

## ⚡ Setup in 5 minutes

### Step 1 — Create a Supabase project
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Settings → API** and copy:
   - `Project URL`
   - `anon / public` key

### Step 2 — Set up the database
1. In Supabase, go to **SQL Editor**
2. Paste the contents of `supabase_setup.sql` and click **Run**

### Step 3 — Add your Supabase keys to the code
Open `js/app.js` and replace lines 10–11:
```js
const SUPABASE_URL  = 'YOUR_SUPABASE_URL';   // ← paste your URL
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY'; // ← paste your key
```

### Step 4 — Deploy to Vercel
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Click **Deploy** — done! 🎉

---

## 📁 Project Structure

```
/project
  index.html          ← Landing page
  stores.html         ← Store listing
  store.html          ← Store profile + products
  product.html        ← Product detail + WhatsApp order
  dashboard.html      ← Store owner dashboard
  login.html          ← Store owner login/signup
  /css/style.css      ← All styles
  /js/app.js          ← All JavaScript + Supabase calls
  supabase_setup.sql  ← Run once to create tables
  vercel.json         ← Vercel clean URL config
```

---

## 🔑 How Authentication Works

- **Customers**: No login needed. Just browse and order.
- **Store owners**: Sign up with email/password. Each owner gets one store.
- Store data is secured with Supabase Row Level Security (RLS) — owners can only edit their own products.

---

## 💬 WhatsApp Integration

When a customer clicks "Order via WhatsApp", the app generates a link like:
```
https://wa.me/96812345678?text=Hello! I would like to order: Fresh Bread ...
```
The message is pre-filled with the product name, link, and delivery type.
The store owner just receives a WhatsApp message — no complex system needed.

---

## 🌍 Omani Pricing

Prices are displayed and stored in **OMR (Omani Rial)** with 3 decimal places:
- `0.500 OMR` = 500 Baisa
- `1.250 OMR` = 1 Rial 250 Baisa

---

## 📱 Mobile First

Designed for mobile screens (360px+). Tested on Android Chrome.
All buttons are large and easy to tap for elderly users.
