export const Toast = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 rounded-lg bg-[var(--panel)] px-4 py-2 text-sm shadow-lg">
      {message}
    </div>
  );
};