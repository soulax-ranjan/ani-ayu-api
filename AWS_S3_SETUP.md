# AWS S3 Integration Guide

This guide explains how to set up and use AWS S3 for image storage in the Ani Ayu API.

## Prerequisites

1. **AWS Account**: You need an active AWS account
2. **AWS CLI** (optional but recommended): For easier configuration

## Step 1: Create an S3 Bucket

1. Log in to the [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **S3** service
3. Click **Create bucket**
4. Configure your bucket:
   - **Bucket name**: Choose a unique name (e.g., `ani-ayu-images`)
   - **Region**: Select your preferred region (e.g., `us-east-1`)
   - **Block Public Access settings**: 
     - Uncheck "Block all public access" if you want public image URLs
     - Or keep it checked if you want to use presigned URLs only
   - Click **Create bucket**

## Step 2: Configure Bucket Permissions

### Option A: Public Access (Recommended for product images)

1. Go to your bucket → **Permissions** tab
2. Edit **Bucket Policy** and add:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

Replace `YOUR-BUCKET-NAME` with your actual bucket name.

3. Edit **CORS configuration**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Option B: Private Access (Use presigned URLs)

If you keep the bucket private, the API will generate presigned URLs for access.

## Step 3: Create IAM User for API Access

1. Navigate to **IAM** service in AWS Console
2. Click **Users** → **Add users**
3. User name: `ani-ayu-api-user`
4. Select **Access key - Programmatic access**
5. Click **Next: Permissions**
6. Click **Attach existing policies directly**
7. Search and select **AmazonS3FullAccess** (or create a custom policy for better security)
8. Click **Next** through the remaining steps
9. **Important**: Save the **Access Key ID** and **Secret Access Key** - you won't see them again!

### Custom IAM Policy (More Secure)

Instead of `AmazonS3FullAccess`, create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

## Step 4: Configure Environment Variables

Add the following to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=your-bucket-name
```

Replace the values with your actual AWS credentials and bucket name.

## Step 5: Test the Integration

### Using cURL

**Upload a single image:**
```bash
curl -X POST http://localhost:3000/upload/image?type=product \
  -F "file=@/path/to/your/image.jpg" \
  -H "Content-Type: multipart/form-data"
```

**Upload multiple images:**
```bash
curl -X POST http://localhost:3000/upload/images?type=product \
  -F "file=@/path/to/image1.jpg" \
  -F "file=@/path/to/image2.jpg" \
  -H "Content-Type: multipart/form-data"
```

**Delete an image:**
```bash
curl -X DELETE "http://localhost:3000/upload/your-file-name.jpg?type=product"
```

### Using Postman

1. Create a new POST request to `http://localhost:3000/upload/image?type=product`
2. Go to **Body** tab
3. Select **form-data**
4. Add a key named `file` and select **File** type
5. Choose your image file
6. Send the request

## Folder Structure in S3

The API organizes images in the following folders:

- `product-images/` - Product images (when `type=product`)
- `banners/` - Banner images (when `type=banner`)

## API Endpoints

### POST /upload/image
Upload a single image to S3.

**Query Parameters:**
- `type` (optional): `product` or `banner` (default: `product`)

**Response:**
```json
{
  "success": true,
  "url": "https://your-bucket.s3.region.amazonaws.com/product-images/filename.jpg",
  "fileName": "filename.jpg"
}
```

### POST /upload/images
Upload multiple images to S3.

**Query Parameters:**
- `type` (optional): `product` or `banner` (default: `product`)

**Response:**
```json
{
  "success": true,
  "urls": [
    {
      "url": "https://your-bucket.s3.region.amazonaws.com/product-images/file1.jpg",
      "fileName": "file1.jpg"
    },
    {
      "url": "https://your-bucket.s3.region.amazonaws.com/product-images/file2.jpg",
      "fileName": "file2.jpg"
    }
  ]
}
```

### DELETE /upload/:fileName
Delete an image from S3.

**Query Parameters:**
- `type` (optional): `product` or `banner` (default: `product`)

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

## Security Best Practices

1. **Never commit AWS credentials** to version control
2. **Use IAM roles** when running on AWS services (EC2, Lambda, etc.)
3. **Rotate access keys** regularly
4. **Use least privilege principle** - only grant necessary permissions
5. **Enable S3 bucket versioning** to protect against accidental deletions
6. **Enable S3 access logging** for audit trails
7. **Use CloudFront CDN** for better performance and security

## Cost Optimization

1. **Use S3 Lifecycle Policies** to move old images to cheaper storage classes
2. **Enable S3 Intelligent-Tiering** for automatic cost optimization
3. **Compress images** before uploading (the API has built-in compression)
4. **Use CloudFront** to reduce S3 data transfer costs

## Troubleshooting

### Error: "Access Denied"
- Check your IAM user permissions
- Verify bucket policy allows the required actions
- Ensure AWS credentials in `.env` are correct

### Error: "Bucket does not exist"
- Verify `AWS_S3_BUCKET_NAME` in `.env` matches your bucket name
- Check the bucket is in the correct region

### Images not loading
- Check bucket CORS configuration
- Verify bucket policy allows public read access
- Check the URL format in the response

### Upload fails
- Check file size limits
- Verify multipart/form-data content type
- Check AWS credentials are valid

## Migration from Supabase

If you're migrating from Supabase storage:

1. **Export existing images** from Supabase
2. **Upload to S3** using AWS CLI or console
3. **Update database URLs** to point to S3
4. **Test thoroughly** before removing Supabase storage

### Bulk Migration Script

You can use the image compression service to migrate and compress images:

```bash
npm run compress-images
```

This will:
- Download images from their current location
- Compress them if needed
- Upload to S3
- Update database URLs

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- [S3 Pricing](https://aws.amazon.com/s3/pricing/)
