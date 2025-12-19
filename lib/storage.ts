export async function uploadImage(file: File, folder: 'boats' | 'services'): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    const { url } = await response.json()
    return url
  } catch (error) {
    console.error('Errore upload:', error)
    return null
  }
}

export async function deleteImage(imageUrl: string): Promise<boolean> {
  // TODO: implementare API per delete se necessario
  return true
}