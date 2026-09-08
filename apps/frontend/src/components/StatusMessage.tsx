interface StatusMessageProps {
  kind: "loading" | "empty" | "error";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StatusMessage({ kind, message, actionLabel, onAction }: StatusMessageProps) {
  return (
    <section className={`status-message status-${kind}`} aria-live={kind === "loading" || kind === "error" ? "polite" : undefined}>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="secondary-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
