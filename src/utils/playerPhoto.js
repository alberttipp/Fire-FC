import { supabase } from '../supabaseClient';

// Client-side resize + upload for player card photos. Resizing keeps the
// payload small (fast upload + fast background removal) and normalizes HEIC ->
// JPEG via canvas (iPhones hand us HEIC). The actual cutout + storage + write
// happens in the `process-avatar` edge function (which also does the auth check
// so parents/kids can upload). Returns { url, cutout }.
const MAX_DIM = 1000;

async function fileToResizedJpegBase64(file) {
    const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('Could not read the image.'));
        fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Could not open the image — try a JPG or PNG.'));
        i.src = dataUrl;
    });
    let { width, height } = img;
    if (Math.max(width, height) > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export async function uploadPlayerPhoto(playerId, file) {
    const imageBase64 = await fileToResizedJpegBase64(file);
    const { data, error } = await supabase.functions.invoke('process-avatar', {
        body: { playerId, imageBase64, contentType: 'image/jpeg' },
    });
    if (error) {
        // surface the function's JSON error body when available
        let msg = error.message;
        try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
        throw new Error(msg || 'Upload failed.');
    }
    if (data?.error) throw new Error(data.error);
    return data; // { url, cutout }
}
