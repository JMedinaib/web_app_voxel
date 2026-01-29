# Deploying Voxel Builder to Vercel

## Prerequisites
- GitHub account
- Vercel account (free at vercel.com)

## Step 1: Push to GitHub

```bash
# Initialize git repo (if not already)
git init
git add .
git commit -m "Initial commit"

# Create new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/voxel-builder.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Select your `voxel-builder` repository
4. Click **"Deploy"** (default settings are fine)
5. Wait for deployment (~1-2 minutes)

## Step 3: Add Blob Storage

1. In your Vercel project dashboard, go to **"Storage"** tab
2. Click **"Create Database"** → Select **"Blob"**
3. Name it `voxel-storage` and click **"Create"**
4. Vercel automatically adds the `BLOB_READ_WRITE_TOKEN` environment variable

## Step 4: Redeploy

1. Go to **"Deployments"** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**

## Done!

Your app is now live at `https://your-project.vercel.app`

Students can:
1. Visit the URL
2. Ctrl+Click to place voxels
3. Right-click → Upload their 3D model (max 10MB)
4. Select a category

All data is saved automatically and shared between all users.

---

## Limits (Free Tier)

| Resource | Limit |
|----------|-------|
| Blob Storage | 500MB total |
| File Upload | **4.5MB per file** |
| Bandwidth | 100GB/month |
| Students | 40 × 4.5MB = 180MB ✅ |

### Important: File Size Limit

Vercel free tier limits uploads to **4.5MB per file**.

**Solutions for students with larger files:**

1. **Compress GLB files** (recommended):
   - Use [gltf.report](https://gltf.report/) - online GLB optimizer
   - Enable DRACO compression (can reduce 10MB → 2MB)
   - In Rhino: export with lower mesh density

2. **Upgrade to Vercel Pro** ($20/month):
   - Increases limit to 500MB per file
   - More storage (1TB)

## Troubleshooting

**Files not uploading?**
- Check browser console for errors
- Verify Blob storage is connected in Vercel dashboard
- Check that `BLOB_READ_WRITE_TOKEN` exists in Environment Variables

**Models not loading?**
- Ensure files are `.glb`, `.gltf`, or `.obj` format
- Check file size is under limit
- Try DRACO-compressed GLB for smaller files

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

Note: Local development won't have Vercel Blob storage - uploads will fail.
For local testing, you can temporarily use the original Express server.
