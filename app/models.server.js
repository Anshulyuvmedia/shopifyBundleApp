import prisma from "./db.server";

export const serialize = (value) => JSON.parse(JSON.stringify(value));

const VALID_STATUSES = ["active", "paused"];
const VALID_DISCOUNT_TYPES = ["percentage", "fixed_amount"];
const VALID_BUNDLE_DISCOUNT_TYPES = ["percentage", "fixed_amount", "none"];
const VALID_DISCOUNT_KINDS = [
  "buy_x_get_y",
  "spend_and_get",
  "fixed_amount",
  "free_shipping",
];

export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

// ------------------------------------------------ Quantity breaks

export async function listQuantityBreaks(shop) {
  const rows = await prisma.quantityBreak.findMany({
    where: { shop },
    include: { tiers: { orderBy: { minQuantity: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return serialize(rows);
}

export async function getQuantityBreak(shop, id) {
  const row = await prisma.quantityBreak.findFirst({
    where: { shop, id },
    include: { tiers: { orderBy: { minQuantity: "asc" } } },
  });
  return row ? serialize(row) : null;
}

export function validateQuantityBreak(data) {
  const errors = {};
  const title = String(data.title ?? "").trim();
  if (!title) errors.title = "Title is required.";

  const status = VALID_STATUSES.includes(data.status) ? data.status : "active";

  const products = Array.isArray(data.products)
    ? data.products
        .map((p) => ({
          id: String(p.id ?? ""),
          title: String(p.title ?? "Untitled product"),
          imageUrl: String(p.imageUrl ?? ""),
        }))
        .filter((p) => p.id)
    : [];

  const tiers = Array.isArray(data.tiers)
    ? data.tiers
        .map((t) => {
          const minQuantity = Math.max(
            1,
            Math.floor(Number(t.minQuantity) || 1),
          );
          const discountType = VALID_DISCOUNT_TYPES.includes(t.discountType)
            ? t.discountType
            : "percentage";
          const discountValue = Number(t.discountValue) || 0;
          return { minQuantity, discountType, discountValue };
        })
        .filter((t) => t.discountValue > 0)
        .sort((a, b) => a.minQuantity - b.minQuantity)
    : [];

  if (tiers.length === 0) {
    errors.tiers = "Add at least one discount tier.";
  }
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].discountType === "percentage" && tiers[i].discountValue > 100) {
      errors.tiers = `Tier at quantity ${tiers[i].minQuantity}: percentage cannot exceed 100.`;
      break;
    }
  }

  return { errors, value: { title, status, products, tiers } };
}

export async function createQuantityBreak(shop, data) {
  const { errors, value } = validateQuantityBreak(data);
  if (Object.keys(errors).length) return { ok: false, errors };

  const row = await prisma.quantityBreak.create({
    data: {
      shop,
      title: value.title,
      status: value.status,
      products: value.products,
      tiers: {
        create: value.tiers.map((t) => ({
          minQuantity: t.minQuantity,
          discountType: t.discountType,
          discountValue: t.discountValue,
        })),
      },
    },
  });
  return { ok: true, id: row.id };
}

export async function updateQuantityBreak(shop, id, data) {
  const { errors, value } = validateQuantityBreak(data);
  if (Object.keys(errors).length) return { ok: false, errors };

  const existing = await prisma.quantityBreak.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };

  await prisma.$transaction([
    prisma.quantityBreakTier.deleteMany({ where: { quantityBreakId: id } }),
    prisma.quantityBreak.update({
      where: { id },
      data: {
        title: value.title,
        status: value.status,
        products: value.products,
        tiers: {
          create: value.tiers.map((t) => ({
            minQuantity: t.minQuantity,
            discountType: t.discountType,
            discountValue: t.discountValue,
          })),
        },
      },
    }),
  ]);
  return { ok: true, id };
}

export async function deleteQuantityBreak(shop, id) {
  const existing = await prisma.quantityBreak.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };
  await prisma.quantityBreak.delete({ where: { id } });
  return { ok: true };
}

// ------------------------------------------------ Bundles

export async function listBundles(shop) {
  const rows = await prisma.bundle.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
  });
  return serialize(rows);
}

export async function getBundle(shop, id) {
  const row = await prisma.bundle.findFirst({ where: { shop, id } });
  return row ? serialize(row) : null;
}

export function validateBundle(data) {
  const errors = {};
  const title = String(data.title ?? "").trim();
  if (!title) errors.title = "Title is required.";

  const label = String(data.label ?? "").trim();
  const description = String(data.description ?? "").trim();
  const freeShippingText = String(data.freeShippingText ?? "").trim();
  const freeGiftText = String(data.freeGiftText ?? "").trim();
  const cardImageUrl = String(data.cardImageUrl ?? "").trim();
  const status = VALID_STATUSES.includes(data.status) ? data.status : "active";

  const discountType = VALID_BUNDLE_DISCOUNT_TYPES.includes(data.discountType)
    ? data.discountType
    : "percentage";
  const discountValue = Number(data.discountValue) || 0;
  if (discountType !== "none" && discountValue <= 0) {
    errors.discountValue = "Enter a discount value greater than 0.";
  }

  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => ({
          id: String(item.id ?? ""),
          productId: String(item.productId ?? item.id ?? ""),
          productTitle: String(item.productTitle ?? "Untitled product"),
          variantTitle: String(item.variantTitle ?? ""),
          imageUrl: String(item.imageUrl ?? ""),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        }))
        .filter((i) => i.id)
    : [];

  if (items.length === 0) errors.items = "Add at least one product to the bundle.";

  return {
    errors,
    value: { title, label, description, freeShippingText, freeGiftText, cardImageUrl, status, discountType, discountValue, items },
  };
}

export async function createBundle(shop, data) {
  const { errors, value } = validateBundle(data);
  if (Object.keys(errors).length) return { ok: false, errors };

  const row = await prisma.bundle.create({
    data: {
      shop,
      title: value.title,
      label: value.label,
      description: value.description,
      freeShippingText: value.freeShippingText,
      freeGiftText: value.freeGiftText,
      cardImageUrl: value.cardImageUrl,
      status: value.status,
      discountType: value.discountType,
      discountValue: value.discountValue,
      items: value.items,
    },
  });
  return { ok: true, id: row.id };
}

export async function updateBundle(shop, id, data) {
  const { errors, value } = validateBundle(data);
  if (Object.keys(errors).length) return { ok: false, errors };

  const existing = await prisma.bundle.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };

  await prisma.bundle.update({
    where: { id },
    data: {
      title: value.title,
      label: value.label,
      description: value.description,
      freeShippingText: value.freeShippingText,
      freeGiftText: value.freeGiftText,
      cardImageUrl: value.cardImageUrl,
      status: value.status,
      discountType: value.discountType,
      discountValue: value.discountValue,
      items: value.items,
    },
  });
  return { ok: true, id };
}

export async function deleteBundle(shop, id) {
  const existing = await prisma.bundle.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };
  await prisma.bundle.delete({ where: { id } });
  return { ok: true };
}

// ------------------------------------------------ Discounts

export async function listDiscounts(shop) {
  const rows = await prisma.discount.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
  });
  return serialize(rows);
}

export async function getDiscount(shop, id) {
  const row = await prisma.discount.findFirst({ where: { shop, id } });
  return row ? serialize(row) : null;
}

export function validateDiscount(data) {
  const errors = {};
  const title = String(data.title ?? "").trim();
  if (!title) errors.title = "Title is required.";

  const type = VALID_DISCOUNT_KINDS.includes(data.type) ? data.type : "";
  if (!type) errors.type = "Select a discount type.";

  const status = VALID_STATUSES.includes(data.status) ? data.status : "active";

  const products = Array.isArray(data.products)
    ? data.products
        .map((p) => ({
          id: String(p.id ?? ""),
          title: String(p.title ?? "Untitled product"),
          imageUrl: String(p.imageUrl ?? ""),
        }))
        .filter((p) => p.id)
    : [];

  const details = data.details && typeof data.details === "object" ? data.details : {};

  const toDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startsAt = toDate(data.startsAt);
  const endsAt = toDate(data.endsAt);

  return { errors, value: { title, type, status, products, details, startsAt, endsAt } };
}

export async function createDiscount(shop, data) {
  const { errors, value } = validateDiscount(data);
  if (Object.keys(errors).length) return { ok: false, errors };

  const row = await prisma.discount.create({
    data: {
      shop,
      title: value.title,
      type: value.type,
      status: value.status,
      products: value.products,
      details: value.details,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
    },
  });
  return { ok: true, id: row.id };
}

export async function updateDiscount(shop, id, data) {
  const { errors, value } = validateDiscount(data);
  if (Object.keys(errors).length) return { ok: false, errors };

  const existing = await prisma.discount.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };

  await prisma.discount.update({
    where: { id },
    data: {
      title: value.title,
      type: value.type,
      status: value.status,
      products: value.products,
      details: value.details,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
    },
  });
  return { ok: true, id };
}

export async function deleteDiscount(shop, id) {
  const existing = await prisma.discount.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };
  await prisma.discount.delete({ where: { id } });
  return { ok: true };
}

export async function saveBundleShopifyDiscountId(shop, id, shopifyDiscountId) {
  const existing = await prisma.bundle.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };
  await prisma.bundle.update({ where: { id }, data: { shopifyDiscountId } });
  return { ok: true };
}

export async function saveShopifyDiscountId(shop, id, shopifyDiscountId) {
  const existing = await prisma.discount.findFirst({
    where: { shop, id },
    select: { id: true },
  });
  if (!existing) return { ok: false, errors: { id: "Not found." } };
  await prisma.discount.update({ where: { id }, data: { shopifyDiscountId } });
  return { ok: true };
}
