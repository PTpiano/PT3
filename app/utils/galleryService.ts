export interface Folder {
  id: string;
  name: string;
  description: string;
  date: string;
  cover?: string;
}

export interface Image {
  id: string;
  src: string;
  category: "LIVE" | "STUDIO" | "BACKSTAGE";
  title: string;
  description: string;
  date: string;
  folder_id: string | null;
  featured?: boolean;
  type: 'image' | 'video'; // New field
  video_url?: string;      // New field
}

type CreateImageData = Omit<Image, 'id'> & { folder_id?: string | null };

// Letture e scritture passano tutte dalle route API
// (il client browser non si connette al database direttamente).

function adminHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Funzioni per la gestione delle cartelle
export const getFolders = async (): Promise<Folder[]> => {
  const response = await fetch('/api/gallery/folders', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch folders');
  }
  return response.json();
};

export const createFolder = async (folderData: Omit<Folder, 'id'>): Promise<string> => {
  const response = await fetch('/api/gallery/folders', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(folderData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create folder');
  }

  const data = await response.json();
  return data.id;
};

export const updateFolder = async (folderId: string, folderData: Partial<Folder>): Promise<void> => {
  const response = await fetch(`/api/gallery/folders/${folderId}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(folderData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update folder');
  }
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  const response = await fetch(`/api/gallery/folders/${folderId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete folder');
  }
};

// Funzioni per la gestione delle immagini
export const getImages = async (folderId?: string): Promise<Image[]> => {
  const params = new URLSearchParams();
  if (folderId) params.set('folder', folderId);
  params.set('limit', '500');
  const qs = params.toString();

  const response = await fetch(`/api/gallery/images${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch images');
  }

  const data = await response.json();
  return (data || []).map((row: any) => ({
    ...row,
    category: row.category as Image["category"],
    folder_id: row.folder_id ?? null,
    type: row.type || 'image',
    video_url: row.video_url,
  }));
};

export const uploadImage = async (file: File): Promise<string> => {
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  if (!adminToken) {
    throw new Error('Unauthorized. Admin access required.');
  }

  const formData = new FormData();
  formData.append('fileType', 'image');
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const details = errorData?.details ? ` (${errorData.details})` : '';
    const code = errorData?.code ? ` [${errorData.code}]` : '';
    throw new Error(`${errorData?.error || 'Failed to upload image'}${details}${code} (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.fileUrl;
};

// Upload multiple images with progress tracking
export const uploadMultipleImages = async (
  images: Array<{
    file: File;
    title: string;
    description: string;
    category: "LIVE" | "STUDIO" | "BACKSTAGE";
    date: string;
    folder_id?: string | null;
  }>,
  onProgress?: (progress: number) => void
): Promise<string[]> => {
  const uploadedImageIds: string[] = [];
  const total = images.length;

  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];

    try {
      // Upload file to storage
      const imageUrl = await uploadImage(imageData.file);

      // Create database record
      const imageId = await createImage({
        src: imageUrl,
        category: imageData.category,
        title: imageData.title,
        description: imageData.description,
        date: imageData.date,
        folder_id: imageData.folder_id,
        type: 'image',
      });

      uploadedImageIds.push(imageId);

      // Update progress
      const progress = Math.round(((i + 1) / total) * 100);
      onProgress?.(progress);

    } catch (error) {
      console.error(`Failed to upload image ${i + 1}:`, error);
      // Continue with other images even if one fails
    }
  }

  return uploadedImageIds;
};

export const createImage = async (imageData: CreateImageData): Promise<string> => {
  const payload = {
    ...imageData,
    folder_id: (imageData as any).folder_id ?? null,
  };

  const response = await fetch('/api/gallery/images', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create image');
  }

  const data = await response.json();
  return data.id;
};

export const updateImage = async (imageId: string, imageData: Partial<Image>): Promise<void> => {
  const payload = {
    ...imageData,
    folder_id: (imageData as any).folder_id ?? undefined,
  };

  const response = await fetch(`/api/gallery/images/${imageId}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update image');
  }
};

export const deleteImage = async (imageId: string): Promise<void> => {
  const response = await fetch(`/api/gallery/images/${imageId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete image');
  }
};

export const moveImage = async (imageId: string, newFolderId: string | null): Promise<void> => {
  await updateImage(imageId, { folder_id: newFolderId || null } as any);
};
