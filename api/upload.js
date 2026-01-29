import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = req.query.filename;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Check file extension
    const ext = filename.split('.').pop().toLowerCase();
    if (!['obj', 'glb', 'gltf'].includes(ext)) {
      return res.status(400).json({ error: 'Only .obj, .glb, and .gltf files are allowed' });
    }

    // Upload to Vercel Blob
    const blob = await put(filename, req, {
      access: 'public',
      addRandomSuffix: true,
    });

    return res.status(200).json({
      success: true,
      file: {
        name: blob.pathname,
        url: blob.url,
        size: blob.size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
}
