import { useRef, useState } from "react";
import { MAX_FILES, MAX_FILE_SIZE, readFileAttachment, type FileAttachment } from "../../../lib/fileChat";
import { deleteFileAttachment, uploadFileAttachment } from "../../../lib/fileStorage";

export const useComposerFiles = () => {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const filePickRef = useRef<HTMLInputElement | null>(null);

  const addFiles = async (picked: FileList | File[] | null) => {
    if (!picked || picked.length === 0) return;
    const list = Array.from(picked as FileList);
    if (files.length + list.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} files`);
      return;
    }
    setFileError(null);
    setReading(true);
    try {
      const oversized: string[] = [];
      let uploadFailed = false;
      const next = (
        await Promise.all(
          list.map(async (f) => {
            if (f.size > MAX_FILE_SIZE) {
              oversized.push(f.name);
              return null;
            }
            const att = await readFileAttachment(f);
            const uploaded = await uploadFileAttachment(f, att.dataUrl);
            if (!uploaded) {
              uploadFailed = true;
              return att;
            }
            return { ...att, attachmentId: uploaded.id };
          })
        )
      ).filter((att): att is FileAttachment => att !== null);
      if (oversized.length > 0) {
        setFileError(`"${oversized[0]}" > 20MB`);
      } else if (uploadFailed) {
        setFileError("Some files could not be saved to cloud storage; they will still be sent.");
      }
      if (next.length) setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
    } catch (e: any) {
      setFileError(e?.message || "Failed to read file");
    } finally {
      setReading(false);
      if (filePickRef.current) filePickRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    const att = files[idx];
    if (att?.attachmentId) void deleteFileAttachment(att.attachmentId);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearFiles = () => {
    setFiles([]);
    setFileError(null);
    if (filePickRef.current) filePickRef.current.value = "";
  };

  return { files, fileError, reading, filePickRef, addFiles, removeFile, clearFiles, setFileError };
};

export type ComposerFiles = ReturnType<typeof useComposerFiles>;
