import { apiFetch, type ApiResponse } from "./api";

export type UploadedAttachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export const uploadFileAttachment = async (
  file: File,
  existingDataUrl?: string
): Promise<UploadedAttachment | null> => {
  try {
    const dataUrl = existingDataUrl || (await readAsDataUrl(file));
    const res = await apiFetch<ApiResponse<{ attachment: UploadedAttachment }>>(
      "/api/files/upload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name || "file",
          mime: file.type || "application/octet-stream",
          size: file.size,
          dataUrl
        })
      }
    );
    return res.data?.attachment ?? null;
  } catch {
    return null;
  }
};

export const getAttachmentUrl = async (
  id: string,
  download = false
): Promise<string | null> => {
  try {
    const res = await apiFetch<ApiResponse<{ url: string }>>(
      `/api/files/${encodeURIComponent(id)}/url${download ? "?download=1" : ""}`
    );
    return res.data?.url ?? null;
  } catch {
    return null;
  }
};

export const deleteFileAttachment = async (id: string): Promise<boolean> => {
  try {
    const res = await apiFetch<ApiResponse<null>>(
      `/api/files/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    return res.success;
  } catch {
    return false;
  }
};
