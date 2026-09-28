import { useRef, useState } from "react";
import { MAX_FILES, MAX_FILE_SIZE, readFileAttachment, type FileAttachment } from "../../../lib/fileChat";

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
      const next: FileAttachment[] = [];
      for (const f of list) {
        if (f.size > MAX_FILE_SIZE) {
          setFileError(`"${f.name}" > 20MB`);
          continue;
        }
        const att = await readFileAttachment(f);
        next.push(att);
      }
      if (next.length) setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
    } catch (e: any) {
      setFileError(e?.message || "Failed to read file");
    } finally {
      setReading(false);
      if (filePickRef.current) filePickRef.current.value = "";
    }
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const clearFiles = () => {
    setFiles([]);
    setFileError(null);
    if (filePickRef.current) filePickRef.current.value = "";
  };

  return { files, fileError, reading, filePickRef, addFiles, removeFile, clearFiles, setFileError };
};

export type ComposerFiles = ReturnType<typeof useComposerFiles>;
