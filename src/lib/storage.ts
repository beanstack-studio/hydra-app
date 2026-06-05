import { supabase } from './supabase'

export async function uploadProductImage(stationId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${stationId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(path)
  return publicUrl
}

export async function uploadStationPhoto(stationId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${stationId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('station-photos')
    .upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage
    .from('station-photos')
    .getPublicUrl(path)
  return publicUrl
}
