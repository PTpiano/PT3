import { ensureValidToken, clearAdminSession } from "./adminSession";

interface ContentUpdate {
  filePath: string;
  oldContent: string;
  newContent: string;
}

export async function updateFileContent({ filePath, oldContent, newContent }: ContentUpdate) {
  try {
    const response = await fetch('/api/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath,
        oldContent,
        newContent,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Errore durante il salvataggio');
    }

    return true;
  } catch (error) {
    console.error('Errore durante l\'aggiornamento del file:', error);
    return false;
  }
}

// Interfaccia per la rappresentazione degli album
export interface Album {
  id: string;
  title: string;
  year: string;
  cover: string;
  description: string;
  tracks: {
    title: string;
    duration: string;
    audioUrl: string;
  }[];
}

// Funzione per ottenere tutti gli album
export async function getAlbums(): Promise<Album[]> {
  try {
    const response = await fetch('/api/albums');

    if (!response.ok) {
      throw new Error('Errore nel recupero degli album');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore durante la lettura degli album:', error);
    return [];
  }
}

// Funzione per aggiungere un nuovo album
export async function addAlbum(album: Album): Promise<Album | null> {
  try {
    const response = await fetch('/api/albums', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(album),
    });

    if (!response.ok) {
      throw new Error('Errore nell\'aggiunta dell\'album');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore durante l\'aggiunta dell\'album:', error);
    return null;
  }
}

// Funzione per aggiornare un album esistente
export async function updateAlbum(album: Album): Promise<Album | null> {
  try {
    const response = await fetch('/api/albums', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(album),
    });

    if (!response.ok) {
      throw new Error('Errore nell\'aggiornamento dell\'album');
    }

    return await response.json();
  } catch (error) {
    console.error('Errore durante l\'aggiornamento dell\'album:', error);
    return null;
  }
}

// Funzione per eliminare un album
export async function deleteAlbum(albumId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/albums?id=${albumId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Errore nell\'eliminazione dell\'album');
    }

    return true;
  } catch (error) {
    console.error('Errore durante l\'eliminazione dell\'album:', error);
    return false;
  }
}

// Funzione per salvare un file audio
export async function saveAudioFile(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('fileType', 'audio');
    formData.append('file', file);

    const adminToken = await ensureValidToken();
    if (!adminToken) {
      throw new Error('Sessione scaduta. Effettua di nuovo il login.');
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAdminSession();
        throw new Error('Sessione scaduta. Effettua di nuovo il login per caricare le tracce.');
      }
      throw new Error('Errore durante il caricamento del file audio');
    }

    const data = await response.json();
    return data.fileUrl;
  } catch (error) {
    console.error('Errore durante il salvataggio del file audio:', error);
    return null;
  }
}

// Funzione per salvare un file immagine
export async function saveImageFile(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('fileType', 'image');
    formData.append('file', file);

    const adminToken = await ensureValidToken();
    if (!adminToken) {
      throw new Error('Sessione scaduta. Effettua di nuovo il login.');
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAdminSession();
        throw new Error('Sessione scaduta. Effettua di nuovo il login per caricare le immagini.');
      }
      throw new Error('Errore durante il caricamento dell\'immagine');
    }

    const data = await response.json();
    return data.fileUrl;
  } catch (error) {
    console.error('Errore durante il salvataggio del file immagine:', error);
    return null;
  }
}

// Funzione per salvare un file copertina album
export async function saveAlbumCoverFile(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('fileType', 'album');
    formData.append('file', file);

    const adminToken = await ensureValidToken();
    if (!adminToken) {
      throw new Error('Sessione scaduta. Effettua di nuovo il login.');
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAdminSession();
        throw new Error('Sessione scaduta. Effettua di nuovo il login per caricare le copertine.');
      }
      const errorText = await response.text();
      console.error('Upload failed with status:', response.status, 'error:', errorText);
      throw new Error(`Errore durante il caricamento della copertina album: ${response.status}`);
    }

    const data = await response.json();
    return data.fileUrl;
  } catch (error) {
    console.error('Errore durante il salvataggio della copertina album:', error);
    return null;
  }
}