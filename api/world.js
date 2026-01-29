import { put, list, del } from '@vercel/blob';

const WORLD_STATE_KEY = 'world-state.json';

export default async function handler(request, response) {
  // GET - Load world state
  if (request.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: WORLD_STATE_KEY });

      if (blobs.length === 0) {
        return response.status(200).json({ voxels: [] });
      }

      const res = await fetch(blobs[0].url);
      const worldState = await res.json();

      return response.status(200).json(worldState);
    } catch (error) {
      console.error('Load world error:', error);
      return response.status(200).json({ voxels: [] });
    }
  }

  // POST - Save world state
  if (request.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of request) {
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

      return response.status(200).json({ success: true, url: blob.url });
    } catch (error) {
      console.error('Save world error:', error);
      return response.status(500).json({ error: 'Failed to save world state' });
    }
  }

  return response.status(405).json({ error: 'Method not allowed' });
}
