const { list } = require('@vercel/blob');

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
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

    return response.status(200).json({ items });
  } catch (error) {
    console.error('List error:', error);
    return response.status(500).json({ error: 'Failed to list files' });
  }
};
