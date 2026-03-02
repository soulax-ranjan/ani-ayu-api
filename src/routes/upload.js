import { uploadToS3, deleteFromS3, getPresignedUrl, getPublicUrl, getFolderName } from '../lib/s3.js'

export default async function uploadRoutes(fastify, opts) {

  // POST /upload/image - Upload single image to AWS S3
  fastify.post('/upload/image', {
    schema: {
      tags: ['Upload'],
      description: 'Upload image to AWS S3',
      consumes: ['multipart/form-data'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['product', 'banner'], default: 'product' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            url: { type: 'string' },
            fileName: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.isMultipart()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Request must be multipart/form-data',
          receivedContentType: request.headers['content-type'] || 'missing'
        })
      }

      const folderName = getFolderName(request.query.type)

      // Get the uploaded file
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded',
          message: 'Please select a file to upload'
        })
      }

      // Validate file type
      if (!data.mimetype.startsWith('image/')) {
        return reply.status(400).send({
          error: 'Invalid file type',
          message: 'Only image files are allowed'
        })
      }

      // Generate unique filename
      const fileExt = data.filename.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

      // Convert stream to buffer
      const fileBuffer = await data.toBuffer()

      // Upload to S3
      const uploadResult = await uploadToS3(fileBuffer, fileName, data.mimetype, folderName)

      if (!uploadResult.success) {
        return reply.status(500).send({
          error: 'Upload failed',
          message: 'Failed to upload file to S3'
        })
      }

      return {
        success: true,
        url: uploadResult.url,
        fileName: fileName
      }

    } catch (error) {
      console.error('Upload error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message
      })
    }
  })

  // POST /upload/images - Upload multiple images to AWS S3
  fastify.post('/upload/images', {
    schema: {
      tags: ['Upload'],
      description: 'Upload multiple images to AWS S3',
      consumes: ['multipart/form-data'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['product', 'banner'], default: 'product' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            urls: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  fileName: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      if (!request.isMultipart()) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Request must be multipart/form-data'
        })
      }

      const folderName = getFolderName(request.query.type)
      const uploadResults = []
      const parts = request.parts()

      for await (const part of parts) {
        if (part.file) {
          try {
            // Validate file type
            if (!part.mimetype.startsWith('image/')) {
              // We must consume the stream even if we ignore it to prevent hanging
              await part.toBuffer()
              continue
            }

            // Generate unique filename
            const fileExt = part.filename.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

            // Convert stream to buffer
            const fileBuffer = await part.toBuffer()

            // Upload to S3
            const uploadResult = await uploadToS3(fileBuffer, fileName, part.mimetype, folderName)

            if (uploadResult.success) {
              uploadResults.push({
                url: uploadResult.url,
                fileName: fileName
              })
            }
          } catch (fileError) {
            console.error('File processing error:', fileError)
          }
        }
      }

      if (uploadResults.length === 0) {
        return reply.status(400).send({
          error: 'No files uploaded',
          message: 'Please select files to upload'
        })
      }

      return {
        success: true,
        urls: uploadResults
      }

    } catch (error) {
      console.error('Multiple upload error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message
      })
    }
  })

  // DELETE /upload/:fileName - Delete image from AWS S3
  fastify.delete('/upload/:fileName', {
    schema: {
      tags: ['Upload'],
      description: 'Delete image from AWS S3',
      params: {
        type: 'object',
        properties: {
          fileName: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['product', 'banner'], default: 'product' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { fileName } = request.params
      const folderName = getFolderName(request.query.type)
      const key = `${folderName}/${fileName}`

      await deleteFromS3(key)

      return {
        success: true,
        message: 'Image deleted successfully'
      }

    } catch (error) {
      console.error('Delete error:', error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message
      })
    }
  })
}