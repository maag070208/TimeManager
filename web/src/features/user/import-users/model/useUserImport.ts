import { useRef, useState } from "react";
import { usersApi } from "@entities/user";

export interface ImportResult {
  created: number;
  skipped: { row: number; username: string; reason: string }[];
}

export const useUserImport = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await usersApi.import(file);
      setResult(res);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return {
    inputRef,
    file,
    setFile,
    uploading,
    error,
    setError,
    result,
    handleImport,
    reset: () => {
      setResult(null);
      setFile(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    },
  };
};

export type UseUserImport = ReturnType<typeof useUserImport>;