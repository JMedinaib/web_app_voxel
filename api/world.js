import { put, list, del } from '@vercel/blob';

const WORLD_STATE_KEY = 'world-state.json';

export default async function handler(req, res) {
  // GET - Load world state
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: WORLD_STATE_KEY });

      if (blobs.length === 0) {
        return res.status(200).json({ voxels: [] });
      }

      // Fetch the world state JSON
      const response = await fetch(blobs[0].url);
      const worldState = await response.json();

      return res.status(200).json(worldState);
    } catch (error) {
      console.error('Load world error:', error);
      return res.status(200).json({ voxels: [] });
    }
  }

  // POST - Save world state
  if (req.method === 'POST') {
    try {
      // Read the request body
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      const worldState = JSON.parse(body);

      // Delete old world state if exists
      const { blobs } = await list({ prefix: WORLD_STATE_KEY });
      for (const blob of blobs) {
        await del(blob.url);
      }

      // Save new world state
      const blob = await put(WORLD_STATE_KEY, JSON.stringify(worldState), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });

      return res.status(200).json({ success: true, url: blob.url });
    } catch (error) {
      console.error('Save world error:', error);
      return res.status(500).json({ error: 'Failed to save world state' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
