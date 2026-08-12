export default function FormErrors({ errors }) {
  const messages = Object.values(errors ?? {}).filter(Boolean);
  if (messages.length === 0) return null;

  return (
    <s-banner tone="critical" heading="Something went wrong">
      <s-unordered-list>
        {messages.map((message, index) => (
          <s-list-item key={index}>{message}</s-list-item>
        ))}
      </s-unordered-list>
    </s-banner>
  );
}
