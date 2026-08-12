export default function EmptyState({ title, description, children }) {
  return (
    <s-box
      padding="large"
      borderWidth="base"
      borderColor="subdued"
      borderRadius="base"
    >
      <s-stack direction="block" gap="base" inlineAlign="center">
        <s-heading>{title}</s-heading>
        <s-paragraph color="subdued">{description}</s-paragraph>
        {children}
      </s-stack>
    </s-box>
  );
}
