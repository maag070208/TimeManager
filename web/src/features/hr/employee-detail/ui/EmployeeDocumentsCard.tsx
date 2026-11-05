import { useMemo, useState } from "react";
import { ITBentoGrid, ITBentoSegments, ITBentoTile, ITCard, ITDropfile, FileTypeEnum, useITBentoCountUp, ITText, ITFlex, ITStack } from "@axzydev/axzy_ui_system";
import { LuCircleCheck, LuFileImage, LuFileText, LuFiles, LuHourglass, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import type { EmployeeDocument, DocumentType } from "@entities/hr";
import { LangostinState } from "@shared/ui/langostin";

interface Props {
  documentTypes: DocumentType[];
  documents: EmployeeDocument[];
  onUpload: (typeId: string, file: File) => Promise<boolean>;
  onRemove: (docId: string) => void;
}

export default function EmployeeDocumentsCard({
  documentTypes,
  documents,
  onUpload,
  onRemove,
}: Props) {
  const { t: tt } = useTranslation(["employees", "common"]);
  // Cada tipo reinicia su propio dropfile al terminar una subida, sin tocar los demás.
  const [dropKeys, setDropKeys] = useState<Record<string, number>>({});

  const byType = useMemo(() => {
    const map = new Map<string, EmployeeDocument[]>();
    for (const doc of documents) {
      const list = map.get(doc.documentTypeId) ?? [];
      list.push(doc);
      map.set(doc.documentTypeId, list);
    }
    return map;
  }, [documents]);

  const requiredCount = documentTypes.length;
  const uploadedTypes = documentTypes.filter((t) => (byType.get(t.id)?.length ?? 0) > 0);
  const uploadedCount = uploadedTypes.length;
  const pendingCount = Math.max(requiredCount - uploadedCount, 0);
  const percent = requiredCount > 0 ? Math.round((uploadedCount / requiredCount) * 100) : 0;

  const uploadedShown = useITBentoCountUp(uploadedCount);
  const pendingShown = useITBentoCountUp(pendingCount);
  const filesShown = useITBentoCountUp(documents.length);

  return (
    <ITStack spacing={5}>
      <ITBentoGrid>
        <ITBentoTile
          cols={6}
          rows={2}
          wide
          tone="plain"
          icon={<LuFiles size={15} />}
          label={tt("detail.documentsTitle")}
          value={uploadedShown}
          aside={`/ ${requiredCount} (${percent}%)`}
        >
          <div className="mt-2">
            <ITBentoSegments total={Math.max(requiredCount, 1)} done={uploadedCount} />
          </div>
        </ITBentoTile>
        <ITBentoTile cols={3} rows={2} wide tone="sun" icon={<LuHourglass size={15} />} label={tt("detail.pending")} value={pendingShown} />
        <ITBentoTile cols={3} rows={2} wide tone="lavender" icon={<LuFileText size={15} />} label={tt("detail.filesLabel")} value={filesShown} />
      </ITBentoGrid>

      {documentTypes.length === 0 && (
        <LangostinState kind="empty" size="sm" title={tt("detail.noDocumentTypes")} description={tt("detail.noDocumentTypesHint")} />
      )}

      <div className="grid grid-cols-1 gap-4 md:!grid-cols-2 xl:!grid-cols-3">
        {documentTypes.map((type) => {
          const files = byType.get(type.id) ?? [];
          const covered = files.length > 0;
          return (
            <ITCard key={type.id} className="flex flex-col">
              <header className="flex items-start gap-3">
                <ITText as="span"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `var(--color-${covered ? "success" : "warning"}-soft)`, color: `var(--color-${covered ? "success" : "warning"})` }}
                >
                  {covered ? <LuCircleCheck size={16} /> : <LuHourglass size={15} />}
                </ITText>
                <ITFlex className="min-w-0 flex-1">
                  <ITText as="h3" className="m-0 truncate !text-[14px] font-bold !text-slate-800">{type.name}</ITText>
                  <ITText className="m-0 text-xs font-medium" style={{ color: `var(--color-${covered ? "success" : "warning"})` }}>
                    {covered ? tt("detail.uploaded") : tt("detail.pendingOne")}
                  </ITText>
                </ITFlex>
              </header>

              {files.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {files.map((file) => (
                    <li key={file.id} className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "var(--color-secondary-100)" }}>
                      <a href={file.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-[color:var(--color-primary)]">
                        {file.mimeType === "application/pdf" ? (
                          <LuFileText size={14} className="shrink-0 text-[color:var(--color-danger)]" />
                        ) : (
                          <LuFileImage size={14} className="shrink-0 text-slate-400" />
                        )}
                        <ITText as="span" className="truncate text-xs font-medium group-hover:underline">{file.originalName}</ITText>
                      </a>
                      <button
                        type="button"
                        onClick={() => onRemove(file.id)}
                        title={tt("common:actions.delete")}
                        className="shrink-0 cursor-pointer rounded-full !border-0 !bg-transparent p-1.5 text-slate-400 transition hover:text-[color:var(--color-danger)]"
                      >
                        <LuX size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4">
                <ITDropfile
                  key={`${type.id}-${dropKeys[type.id] ?? 0}`}
                  autoUpload
                  showStatusBadge={false}
                  onFileSelect={() => undefined}
                  onSubmit={async (file) => {
                    const ok = await onUpload(type.id, file);
                    // Un fallo se lanza para que el dropfile muestre el estado de error.
                    if (!ok) throw new Error("document upload failed");
                    setDropKeys((k) => ({ ...k, [type.id]: (k[type.id] ?? 0) + 1 }));
                  }}
                  acceptedFileTypes={[FileTypeEnum.PNG, FileTypeEnum.JPG, FileTypeEnum.JPEG, FileTypeEnum.PDF]}
                />
              </div>
            </ITCard>
          );
        })}
      </div>

    </ITStack>
  );
}
