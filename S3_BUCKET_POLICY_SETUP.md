# AWS S3 Bucket Policy Setup Guide

## Issue
Your S3 bucket `ani-ayu-products-images` has **ACLs disabled**, which is AWS's recommended security practice. To make uploaded images publicly accessible, you need to set a **bucket policy** instead.

## Quick Setup Steps

### Step 1: Go to AWS S3 Console

1. Open your browser and go to: https://console.aws.amazon.com/s3/
2. Sign in with your AWS credentials
3. Click on your bucket: **ani-ayu-products-images**

### Step 2: Configure Bucket Policy

1. Click on the **Permissions** tab
2. Scroll down to **Bucket policy** section
3. Click **Edit**
4. Copy and paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ani-ayu-products-images/*"
    }
  ]
}
```

5. Click **Save changes**

### Step 3: Unblock Public Access (if needed)

If you get an error about public access being blocked:

1. In the **Permissions** tab, find **Block public access (bucket settings)**
2. Click **Edit**
3. **Uncheck** the following:
   - ✅ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public and cross-account access to buckets and objects through any public bucket or access point policies

4. Click **Save changes**
5. Type `confirm` when prompted
6. Now go back and add the bucket policy from Step 2

## What This Does

- **Allows public read access** to all objects in your bucket
- **Does NOT allow** public write/delete access (only your API can upload/delete)
- **Uses bucket-level permissions** instead of object-level ACLs
- **Follows AWS best practices** for public content buckets

## Security Notes

✅ **Safe**: This policy only allows reading (downloading) files
✅ **Controlled**: Only your API (with AWS credentials) can upload/delete
✅ **Standard**: This is the recommended approach for public content buckets

## Alternative: Private Bucket with Presigned URLs

If you prefer to keep the bucket private and generate temporary URLs:

1. **Don't add the bucket policy above**
2. **Keep Block Public Access enabled**
3. The API will automatically use presigned URLs (already implemented in the code)

Note: Presigned URLs expire after a set time (default: 1 hour)

## Verify It Works

After setting the bucket policy:

1. Upload an image using the API
2. Copy the returned URL
3. Open it in a browser - you should see the image!

Example URL format:
```
https://ani-ayu-products-images.s3.ap-south-1.amazonaws.com/product-images/1739123456789-abc123.jpg
```

## Troubleshooting

### Error: "Access Denied" when viewing images
- Check that the bucket policy is correctly applied
- Verify Block Public Access settings allow bucket policies
- Ensure the Resource ARN matches your bucket name

### Error: "The bucket policy is invalid"
- Make sure you replaced `ani-ayu-products-images` with your actual bucket name
- Check for JSON syntax errors (missing commas, brackets)

### Images upload but can't be viewed
- The bucket policy is not applied or blocked
- Follow Step 3 to unblock public access for bucket policies

## Need Help?

If you encounter issues:
1. Check the AWS S3 console for error messages
2. Verify your bucket name matches in the policy
3. Ensure you have permissions to modify bucket policies
4. Contact AWS support if needed

## Summary

✅ **Bucket**: ani-ayu-products-images  
✅ **Region**: ap-south-1  
✅ **Policy Type**: Public read access  
✅ **Upload API**: Working at http://localhost:3002/upload/image  
✅ **Test Interface**: http://localhost:3002/docs
