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
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  /** Descarga la plantilla .xlsx del formato (mismas columnas que el import). */
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError(null);
    try {
      const blob = await usersApi.importTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "plantilla-usuarios.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

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
    downloadingTemplate,
    handleDownloadTemplate,
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