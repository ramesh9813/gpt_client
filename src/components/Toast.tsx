import "./Toast.css";

export const Toast = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <div className="toast">
      {message}
    </div>
  );
};
