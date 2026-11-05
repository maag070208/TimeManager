import { useEffect, useState } from "react";
import type { PersonalProfile } from "@entities/hr";
import { personalApi } from "@entities/hr";
import { generateCredentialQr, photoAsDataUrl, initialsOf } from "./credential";
import { credentialDataUrl } from "./image";
import { i18n } from "@shared/i18n";

interface EmployeeCredentialStatus {
  qrDataUrl: string | null;
  photoDataUrl: string | null;
  imageDataUrl: string | null;
  initials: string;
  loading: boolean;
  error: string | null;
}

export const useEmployeeCredential = (
  profile: PersonalProfile | null
): EmployeeCredentialStatus => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("—");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setQrDataUrl(null);
      setPhotoDataUrl(null);
      setImageDataUrl(null);
      setInitials("—");
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [qr, photo] = await Promise.all([
          generateCredentialQr(profile),
          photoAsDataUrl(
            profile.id ? personalApi.photoRawUrl(profile.id) : null
          ),
        ]);
        if (cancelled) return;
        const initialsValue = initialsOf(profile.name);
        setQrDataUrl(qr);
        setPhotoDataUrl(photo);
        setInitials(initialsValue);

        const image = await credentialDataUrl({
          profile,
          qrDataUrl: qr,
          photoDataUrl: photo,
          initials: initialsValue,
        });
        if (cancelled) return;
        setImageDataUrl(image);
        setError(null);
      } catch {
        if (cancelled) return;
        setError(i18n.t("employees:credential.generateError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      setImageDataUrl(null);
    };
  }, [profile?.id, profile]);

  return { qrDataUrl, photoDataUrl, imageDataUrl, initials, loading, error };
};
