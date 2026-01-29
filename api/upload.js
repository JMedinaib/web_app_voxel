const { put } = require('@vercel/blob');

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = request.query.filename;

    if (!filename) {
      return response.status(400).json({ error: 'Filename is required' });
    }

    const ext = filename.split('.').pop().toLowerCase();
    if (!['obj', 'glb', 'gltf'].includes(ext)) {
      return response.status(400).json({ error: 'Only .obj, .glb, and .gltf files are allowed' });
    }

    const blob = await put(filename, request, {
      access: 'public',
      addRandomSuffix: true,
    });

    return response.status(200).json({
      success: true,
      file: {
        name: blob.pathname,
        url: blob.url,
        size: blob.size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return response.status(500).json({ error: 'Upload failed: ' + error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
