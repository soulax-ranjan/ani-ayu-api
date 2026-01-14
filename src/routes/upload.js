import { supabase, supabaseAdmin } from '../lib/supabase.js'

export default async function uploadRoutes(fastify, opts) {
  // Helper to determine bucket name
  const getBucketName = (type) => {
    switch (type) {
      case 'banner':
        return 'banners'
      case 'product':
      default:
        return 'product-images'
    }
  }

  // POST /upload/image - Upload single image to Supabase Storage
  fastify.post('/upload/image', {
    schema: {
      tags: ['Upload'],
      description: 'Upload image to Supabase Storage',
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

      const bucketName = getBucketName(request.query.type)

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
      
      // Upload to Supabase Storage using stream
      // duplex: 'half' is required for Node.js environments with node-fetch under the hood
      // Use supabaseAdmin to bypass RLS
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(fileName, data.file, {
          contentType: data.mimetype,
          upsert: false,
          duplex: 'half'
        })

      if (uploadError) {
        console.error('Supabase upload error:', uploadError)
        return reply.status(500).send({
          error: 'Upload failed',
          message: uploadError.message
        })
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      return {
        success: true,
        url: urlData.publicUrl,
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

  // POST /upload/images - Upload multiple images
  fastify.post('/upload/images', {
    schema: {
      tags: ['Upload'],
      description: 'Upload multiple images to Supabase Storage',
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

      const bucketName = getBucketName(request.query.type)
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
            
            // Upload to Supabase Storage using stream
            // Use supabaseAdmin to bypass RLS
            const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
              .from(bucketName)
              .upload(fileName, part.file, {
                contentType: part.mimetype,
                upsert: false,
                duplex: 'half'
              })

            if (!uploadError) {
              // Get public URL
              const { data: urlData } = supabaseAdmin.storage
                .from(bucketName)
                .getPublicUrl(fileName)

              uploadResults.push({
                url: urlData.publicUrl,
                fileName: fileName
              })
            } else {
              console.error('File upload error:', uploadError)
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

  // DELETE /upload/:fileName - Delete image from Supabase Storage
  fastify.delete('/upload/:fileName', {
    schema: {
      tags: ['Upload'],
      description: 'Delete image from Supabase Storage',
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
      const bucketName = getBucketName(request.query.type)

      const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .remove([fileName])

      if (error) {
        return reply.status(500).send({
          error: 'Delete failed',
          message: error.message
        })
      }

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