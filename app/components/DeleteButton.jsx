import { useState } from "react";

export default function DeleteButton({ onConfirm, label = "Delete" }) {
  const [deleting, setDeleting] = useState(false);
  const modalId = `confirm-delete-${Math.random().toString(36).slice(2)}`;

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <s-stack direction="inline" gap="none" blockAlign="center">
      <s-button
        variant="tertiary"
        tone="critical"
        command="--show"
        commandFor={modalId}
      >
        {label}
      </s-button>
      <s-modal
        id={modalId}
        heading={`${label}?`}
        onAfterHide={() => setDeleting(false)}
      >
        <s-paragraph>
          Are you sure? This action cannot be undone.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          loading={deleting}
          onClick={handleConfirm}
        >
          {label}
        </s-button>
        <s-button
          slot="secondary-actions"
          command="--hide"
          commandFor={modalId}
        >
          Cancel
        </s-button>
      </s-modal>
    </s-stack>
  );
}
