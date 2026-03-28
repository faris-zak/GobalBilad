import { adminClient, json, requireAdmin } from './_supabase-admin.js';

const SEED_STORES = [
  {
    name: 'بقالة البركة',
    whatsapp_phone: '96893281000',
    products: [
      { name: 'أرز بسمتي 5 كجم', price: 3.200 },
      { name: 'سكر أبيض 2 كجم', price: 0.950 },
      { name: 'حليب طويل الأجل 1 لتر', price: 0.550 }
    ]
  },
  {
    name: 'مخبز النور',
    whatsapp_phone: '96872299603',
    products: [
      { name: 'خبز رقاق', price: 0.500 },
      { name: 'خبز قمح كامل', price: 0.800 },
      { name: 'كرواسون', price: 0.300 }
    ]
  },
  {
    name: 'خضار المعمورة',
    whatsapp_phone: '96895550123',
    products: [
      { name: 'طماطم 1 كجم', price: 0.600 },
      { name: 'بطاطس 1 كجم', price: 0.450 },
      { name: 'خيار 1 كجم', price: 0.500 }
    ]
  }
];

async function getOrCreateStore(seedStore, ownerUserId) {
  const { data: existingStore, error: readError } = await adminClient
    .from('stores')
    .select('id, name')
    .eq('name', seedStore.name)
    .maybeSingle();

  if (readError) {
    throw new Error(`Store lookup failed for ${seedStore.name}: ${readError.message}`);
  }

  if (existingStore) {
    await adminClient
      .from('stores')
      .update({
        whatsapp_phone: seedStore.whatsapp_phone,
        is_active: true,
        owner_user_id: ownerUserId
      })
      .eq('id', existingStore.id);

    return { id: existingStore.id, isNew: false };
  }

  const { data: createdStore, error: createError } = await adminClient
    .from('stores')
    .insert({
      name: seedStore.name,
      whatsapp_phone: seedStore.whatsapp_phone,
      owner_user_id: ownerUserId,
      is_active: true
    })
    .select('id')
    .single();

  if (createError || !createdStore) {
    throw new Error(`Store create failed for ${seedStore.name}: ${createError?.message || 'unknown error'}`);
  }

  return { id: createdStore.id, isNew: true };
}

async function seedProductsForStore(storeId, seedProducts) {
  const { data: existingProducts, error: readError } = await adminClient
    .from('products')
    .select('name')
    .eq('store_id', storeId);

  if (readError) {
    throw new Error(`Products lookup failed: ${readError.message}`);
  }

  const existingNames = new Set((existingProducts || []).map((item) => String(item.name).trim()));
  const missingProducts = seedProducts.filter((item) => !existingNames.has(String(item.name).trim()));

  if (!missingProducts.length) {
    return 0;
  }

  const { error: insertError } = await adminClient
    .from('products')
    .insert(
      missingProducts.map((item) => ({
        store_id: storeId,
        name: item.name,
        price: Number(item.price.toFixed(3)),
        is_available: true
      }))
    );

  if (insertError) {
    throw new Error(`Products insert failed: ${insertError.message}`);
  }

  return missingProducts.length;
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST /api/admin-seed-helper' });
  }

  try {
    let createdStores = 0;
    let existingStores = 0;
    let createdProducts = 0;

    for (const seedStore of SEED_STORES) {
      const store = await getOrCreateStore(seedStore, admin.user.id);
      if (store.isNew) {
        createdStores += 1;
      } else {
        existingStores += 1;
      }

      createdProducts += await seedProductsForStore(store.id, seedStore.products);
    }

    return json(res, 200, {
      message: 'Seed completed successfully',
      result: {
        createdStores,
        existingStores,
        createdProducts,
        totalSeedStores: SEED_STORES.length
      }
    });
  } catch (err) {
    return json(res, 500, {
      error: 'SEED_FAILED',
      message: err.message || 'Unexpected seed error'
    });
  }
}
