export default function TierEditor({ tiers, onChange }) {
  const updateTier = (index, patch) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  const addTier = () => {
    const lastMin = tiers.reduce(
      (max, tier) => Math.max(max, Number(tier.minQuantity) || 0),
      0,
    );
    onChange([
      ...tiers,
      { minQuantity: lastMin + 1, discountType: "percentage", discountValue: 10 },
    ]);
  };

  const removeTier = (index) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <s-stack direction="block" gap="base">
      {tiers.map((tier, index) => (
        <s-box
          key={index}
          padding="small"
          borderWidth="base"
          borderColor="subdued"
          borderRadius="base"
        >
          <s-stack direction="inline" gap="base" blockAlign="end">
            <s-number-field
              label="Min quantity"
              value={String(tier.minQuantity ?? 1)}
              min="1"
              onInput={(event) =>
                updateTier(index, { minQuantity: event.target.value })
              }
            />
            <s-select
              label="Discount type"
              value={tier.discountType}
              onInput={(event) =>
                updateTier(index, { discountType: event.target.value })
              }
            >
              <s-option value="percentage">Percentage off</s-option>
              <s-option value="fixed_amount">Fixed amount off</s-option>
            </s-select>
            <s-number-field
              label="Discount value"
              value={String(tier.discountValue ?? 0)}
              min="0"
              step="0.01"
              onInput={(event) =>
                updateTier(index, { discountValue: event.target.value })
              }
            />
            <s-button
              onClick={() => removeTier(index)}
              variant="tertiary"
              tone="critical"
            >
              Remove
            </s-button>
          </s-stack>
        </s-box>
      ))}
      <s-button onClick={addTier} variant="secondary">
        Add tier
      </s-button>
    </s-stack>
  );
}
