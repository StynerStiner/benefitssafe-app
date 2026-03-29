# Avatar Upload Setup Guide

This document explains the complete avatar/profile image upload system for BenefitsSafe, including S3 migration for production.

## Overview

- **Local Development:** Can use local filesystem OR S3
- **Production:** MUST use S3 (AWS, DigitalOcean Spaces, etc.)
- **Features:** Profile image upload, automatic S3 storage, database persistence, public CDN URLs

---

## Architecture

### Flow:
1. User selects image in form → File input
2. Frontend validates (type, size) → Shows preview
3. Form calls `/api/users/avatar` → multipart/form-data
4. API uploads to S3 → Gets public URL
5. Returns URL → Saves to User.avatarUrl in database
6. Dashboard fetches with avatarUrl → Displays image

### Files Updated:
- `lib/s3-upload.ts` — AWS SDK S3 upload utility
- `app/api/users/avatar/route.ts` — Avatar endpoint (now uses S3)
- `app/(dashboard)/(homes)/beneficiaries/components/add-beneficiary-form.tsx` — File input UI
- `/api/beneficiaries`, `/api/grants`, `/api/vendors` — Return avatarUrl in responses

---

## Setup Instructions

### Step 1: AWS S3 Bucket Setup

**Option A: Using AWS S3 (Recommended for Production)**

1. Create S3 bucket in AWS console:
   - Bucket name: `benefitssafe-uploads` (or custom name)
   - Region: `us-east-1` (or your region)
   - ACL: Enable (needed for public-read)
   - Block public access: Disable

2. Create IAM user with S3 permissions:
   - Policy: `AmazonS3FullAccess` OR custom policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::benefitssafe-uploads",
           "arn:aws:s3:::benefitssafe-uploads/*"
         ]
       }
     ]
   }
   ```

3. Get IAM credentials:
   - Access Key ID
   - Secret Access Key

**Option B: Using DigitalOcean Spaces (Cheaper Alternative)**
- Create Spaces bucket (compatible with AWS S3 SDK)
- Get access keys from Spaces console
- Update AWS_REGION to `nyc3` (or your region)
- Update AWS_S3_BUCKET_URL to Spaces endpoint

**Option C: Using MinIO (Self-Hosted)**
- Deploy MinIO server
- Create bucket
- Update endpoints in .env

### Step 2: Configure Environment Variables

Add to `.env.local`:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=benefitssafe-uploads
AWS_S3_BUCKET_URL=https://benefitssafe-uploads.s3.amazonaws.com
```

### Step 3: Test Upload

1. Start dev server:
   ```bash
   npm run dev -- -p 3002
   ```

2. Go to Beneficiaries page
3. Click "+ Add Beneficiary"
4. Upload a profile image (PNG, JPEG, WebP, max 5MB)
5. Verify:
   - Image preview shows in form
   - "Avatar uploaded successfully" toast appears
   - Image URL saves to database
   - Image appears when beneficiary list reloads

### Step 4: Verify in Database

```sql
-- Check avatarUrl was saved
SELECT id, firstName, lastName, avatarUrl
FROM "User"
WHERE role = 'beneficiary'
AND avatarUrl IS NOT NULL;
```

---

## API Response Examples

### After Upload:
```json
{
  "avatarUrl": "https://benefitssafe-uploads.s3.amazonaws.com/avatars/user-123-1234567890.jpg"
}
```

### GET /api/beneficiaries:
```json
[
  {
    "id": "beneficiary-1",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "avatarUrl": "https://benefitssafe-uploads.s3.amazonaws.com/avatars/user-123-1234567890.jpg",
    "isActive": true,
    "createdAt": "2026-03-29T02:00:00Z"
  }
]
```

---

## Deployment Checklist

### Before Going Live:

- [ ] AWS/S3 bucket created and configured
- [ ] IAM user credentials obtained
- [ ] `.env` variables set (don't commit to git!)
- [ ] Test upload on dev server works
- [ ] Test avatar displays on dashboard
- [ ] Test data persistence (refresh page, avatar still shows)
- [ ] Test cross-org data isolation (can't see other org's avatars)
- [ ] S3 bucket CORS configured (if needed):
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["https://yourdomain.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```

### Vercel Deployment:

1. Add environment variables to Vercel project settings
2. Deploy
3. Test uploads on live site
4. Monitor CloudWatch logs for S3 errors

### Monitoring:

- AWS CloudWatch: Monitor S3 upload errors
- Application Logs: Check `/api/users/avatar` errors
- Database: Verify avatarUrl fields have values

---

## Troubleshooting

### Error: "AWS_S3_BUCKET environment variable not set"
- Solution: Add `AWS_S3_BUCKET` to `.env.local`

### Error: "Failed to upload file to S3"
- Check: AWS credentials are correct
- Check: S3 bucket exists and IAM user has permissions
- Check: Region matches bucket region
- Check: Internet connection works

### Image uploads to S3 but doesn't show on dashboard
- Check: AWS_S3_BUCKET_URL is correct (should be public-read)
- Check: S3 bucket public access is enabled
- Check: Browser cache (hard refresh)
- Check: Database saved the avatarUrl

### Error: "Only PNG, JPEG, and WebP images are supported"
- Solution: Upload PNG, JPG, or WebP file
- Check file format: `file image.jpg` (not .txt)

### Slow uploads on production
- Solution: S3 CDN might have latency
- Consider: Use CloudFront distribution in front of S3
- Monitor: AWS S3 metrics in CloudWatch

---

## Architecture Decisions

### Why S3?
- ✅ Works everywhere (Vercel, AWS Lambda, traditional servers)
- ✅ Highly available and durable
- ✅ Built-in CDN for fast image delivery
- ✅ Scales automatically
- ✅ Cost-effective ($0.023 per GB stored)
- ✅ Works with all major cloud providers

### Why Not Local Filesystem?
- ❌ Doesn't work on Vercel (ephemeral filesystem)
- ❌ Doesn't work on Heroku (ephemeral filesystem)
- ❌ File loss on server restart
- ❌ Doesn't scale to multiple servers

### Why Not Database?
- ❌ Wastes database storage ($0.50/GB → $23/GB)
- ❌ Slower retrieval
- ❌ Harder to serve images efficiently
- ❌ Backup bloat

---

## Future Enhancements

- [ ] Add image cropping before upload (crop widget)
- [ ] Add image compression (reduce file size)
- [ ] Add progress bar for uploads
- [ ] Add drag-and-drop upload
- [ ] Add multiple file uploads
- [ ] Add image filters/editing
- [ ] Add image cache busting
- [ ] Add malware scanning (AWS Macie)
- [ ] Add CloudFront CDN distribution
- [ ] Add S3 lifecycle policies (delete old avatars)

---

## Security Considerations

### Current Protections:
- ✅ File type validation (only images)
- ✅ File size limit (5MB max)
- ✅ Authentication required (session check)
- ✅ Organization scoping (avatars belong to org users)
- ✅ Unique filenames (UUID prevents collision)
- ✅ S3 ACL: public-read (prevents private data exposure)

### Additional Hardening:
- [ ] Add malware scanning (ClamAV)
- [ ] Add EXIF data stripping (privacy)
- [ ] Add rate limiting (prevent abuse)
- [ ] Add image signature verification
- [ ] Add expiry policy for old uploads
- [ ] Add audit logging for uploads
- [ ] Use signed URLs instead of public-read

---

## Cost Estimates

### AWS S3 (Conservative):
- Storage: 1GB = $0.023/month
- Requests: 1M uploads/month = $0.50
- Data transfer: 1GB downloads = $0.09
- **Total: ~$0.60/month for modest usage**

### With CloudFront CDN:
- CloudFront: ~$0.085 per GB delivered
- Reduced S3 requests (cached images)
- **Total: ~$1-2/month with heavy usage**

---

## Support

For issues:
1. Check CloudWatch logs: `aws logs tail /aws/lambda/avatar-upload`
2. Check S3 bucket policy in AWS console
3. Verify IAM credentials are active
4. Check network connectivity
5. Review error messages in application logs
