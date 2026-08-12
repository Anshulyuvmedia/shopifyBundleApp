export default function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <s-badge tone={active ? "success" : "critical"}>
      {active ? "Active" : "Paused"}
    </s-badge>
  );
}
