import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { blobs } = await list();

    const items = blobs
      .filter(blob => {
        const ext = blob.pathname.split('.').pop().toLowerCase();
        return ['obj', 'glb', 'gltf'].includes(ext);
      })
      .map(blob => ({
        name: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }));

    return res.status(200).json({ items });
  } catch (error) {
    console.error('List error:', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
}
