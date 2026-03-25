# جوب البلاد 🛒
**منصة السوق المحلي - المعمورة، سلطنة عُمان**

منصة ويب محلية تربط بين العملاء والمتاجر وسائقي التوصيل في منطقة المعمورة.

---

## الميزات الرئيسية

- **العملاء** — تصفح المتاجر والمنتجات، إضافة سلة تسوق، تقديم الطلبات عبر WhatsApp
- **أصحاب المتاجر** — لوحة تحكم لإدارة المنتجات وتتبع الطلبات في الوقت الفعلي
- **سائقو التوصيل** — تفعيل/تعطيل الخدمة، استلام وتوصيل الطلبات
- **الإدارة** — مراجعة وقبول/رفض طلبات المتاجر والسائقين، إحصاءات شاملة

---

## المجلد وهيكل الملفات

```
/
├── index.html              # الصفحة الرئيسية (قائمة المتاجر)
├── store.html              # صفحة المتجر (المنتجات)
├── cart.html               # سلة التسوق
├── checkout.html           # تأكيد الطلب
├── orders.html             # سجل الطلبات
├── profile.html            # الملف الشخصي
├── login.html              # تسجيل الدخول
├── register-store.html     # تسجيل متجر جديد
├── register-driver.html    # التسجيل كسائق
│
├── dashboard/
│   ├── store.html          # لوحة تحكم المتجر
│   ├── driver.html         # لوحة تحكم السائق
│   └── admin.html          # لوحة تحكم الإدارة
│
├── api/
│   ├── supabase.js         # ← ضع بيانات Supabase هنا
│   ├── auth.js
│   ├── stores.js
│   ├── products.js
│   ├── orders.js
│   ├── drivers.js
│   └── users.js
│
├── assets/
│   ├── css/
│   │   ├── variables.css
│   │   ├── main.css
│   │   ├── components.css
│   │   └── utilities.css
│   └── js/
│       ├── app.js
│       ├── cart.js
│       ├── location.js
│       ├── whatsapp.js
│       └── components.js
│
├── lib/
│   ├── constants.js
│   ├── helpers.js
│   └── validation.js
│
├── sql/
│   └── schema.sql          # مخطط قاعدة البيانات كامل
│
├── vercel.json
└── .env.example
```

---

## إعداد المشروع (خطوة بخطوة)

### 1. إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ حساباً
2. أنشئ مشروعاً جديداً (اختر منطقة قريبة، مثل Middle East)
3. انتظر حتى يكتمل إعداد المشروع

### 2. إعداد قاعدة البيانات

1. في لوحة تحكم Supabase، اذهب إلى **SQL Editor**
2. انسخ محتوى ملف `sql/schema.sql`
3. الصقه في SQL Editor، ثم اضغط **Run**
4. تحقق من نجاح تنفيذ جميع الأوامر

### 3. تفعيل Google OAuth

1. اذهب إلى **Authentication → Providers → Google**
2. قم بتفعيل المزوّد Google
3. أدخل **Client ID** و **Client Secret** من [Google Cloud Console](https://console.cloud.google.com)
4. أضف Redirect URI:
   - للإنتاج: `https://your-domain.vercel.app/index.html`
   - للتطوير المحلي: `http://localhost:5500/index.html`

### 4. ربط Supabase بالكود

1. في لوحة تحكم Supabase، اذهب إلى **Project Settings → API**
2. انسخ **Project URL** و **anon/public key**
3. افتح ملف `api/supabase.js` وضعهما:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...YOUR_ANON_KEY...';
```

### 5. إنشاء حساب المدير

1. سجّل دخولاً جديداً عبر التطبيق (Google أو email)
2. في Supabase Dashboard، اذهب إلى **Table Editor → users**
3. ابحث عن صف المستخدم المطلوب
4. غيّر قيمة العمود `role` إلى: `admin`

### 6. الرفع على Vercel

1. ارفع المشروع على GitHub
2. اذهب إلى [vercel.com](https://vercel.com) وأنشئ مشروعاً جديداً
3. اربطه بـ Repository على GitHub
4. اضغط **Deploy** (لا يحتاج إلى إعداد Build إضافي — مشروع ثابت)
5. بعد النشر، أضف Redirect URI الجديد في Google OAuth وفي Supabase

---

## للتطوير المحلي

تحتاج إلى خادم محلي بسيط (لأن الصفحات تحمّل ملفات JS عبر مسارات مطلقة):

**باستخدام VS Code Live Server:**
1. ثبّت إضافة [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. انقر بزر الماوس الأيمن على `index.html` → **Open with Live Server**

**أو باستخدام Python:**
```bash
python -m http.server 5500
```

**أو باستخدام Node.js:**
```bash
npx serve .
```

ثم افتح `http://localhost:5500` في المتصفح.

---

## التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| HTML5 / CSS3 / JavaScript (Vanilla) | واجهة المستخدم — لا يوجد frameworks |
| [Supabase](https://supabase.com) | قاعدة البيانات + المصادقة + Realtime |
| [Google OAuth](https://developers.google.com/identity) | تسجيل دخول العملاء |
| [WhatsApp wa.me](https://faq.whatsapp.com/425247423114725) | إشعارات الطلبات |
| [Vercel](https://vercel.com) | الاستضافة والنشر |
| [Tajawal Font](https://fonts.google.com/specimen/Tajawal) | خط عربي من Google Fonts |

---

## التسعير والتوصيل

| مجموع الطلب | رسوم التوصيل |
|-------------|-------------|
| 0 – 10 ريال | **0.300 ريال** |
| 10 – 50 ريال | **0.500 ريال** |
| أكثر من 50 ريال | ❌ لا يُقبل |

> **التوصيل مجاني** لجميع الطلبات خلال أول 7 أيام من إطلاق المنصة.

---

## صلاحيات المستخدمين

| الدور | الصفحات المتاحة |
|-------|----------------|
| `customer` | الصفحة الرئيسية، المتجر، السلة، طلباتي، الملف الشخصي |
| `store` | كل ما سبق + `/dashboard/store` |
| `driver` | `/dashboard/driver` |
| `admin` | `/dashboard/admin` |

---

## ملاحظات الأمان

- بيانات Supabase Anon Key آمنة للمتصفح (محمية بـ Row Level Security)
- جميع العمليات الحساسة محمية بـ RLS في قاعدة البيانات
- لا تضع `service_role` key في كود الواجهة أبداً
- جميع مدخلات المستخدمين يتم تعقيمها قبل العرض

---

*بُني بـ ❤️ لخدمة مجتمع المعمورة، سلطنة عُمان*
