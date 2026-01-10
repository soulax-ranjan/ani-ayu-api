import { supabase } from '../lib/supabase.js'

export default async function uploadRoutes(fastify, opts) {
  // Register multipart plugin for file uploads
  await fastify.register(import('@fastify/multipart'))

  // POST /api/upload/image - Upload single image to Supabase Storage
  fastify.post('/upload/image', {
    schema: {
      tags: ['Upload'],
      description: 'Upload image to Supabase Storage',
      consumes: ['multipart/form-data'],
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
      const buffer = await data.toBuffer()

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, buffer, {
          contentType: data.mimetype,
          upsert: false
        })

      if (uploadError) {
        console.error('Supabase upload error:', uploadError)
        return reply.status(500).send({
          error: 'Upload failed',
          message: uploadError.message
        })
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
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

  // POST /api/upload/images - Upload multiple images
  fastify.post('/upload/images', {
    schema: {
      tags: ['Upload'],
      description: 'Upload multiple images to Supabase Storage',
      consumes: ['multipart/form-data'],
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
      const files = []
      const parts = request.parts()
      
      for await (const part of parts) {
        if (part.file) {
          files.push(part)
        }
      }

      if (files.length === 0) {
        return reply.status(400).send({
          error: 'No files uploaded',
          message: 'Please select files to upload'
        })
      }

      const uploadResults = []

      for (const file of files) {
        try {
          // Validate file type
          if (!file.mimetype.startsWith('image/')) {
            continue // Skip non-image files
          }

          // Generate unique filename
          const fileExt = file.filename.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
          
          // Convert stream to buffer
          const buffer = await file.toBuffer()

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, buffer, {
              contentType: file.mimetype,
              upsert: false
            })

          if (!uploadError) {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(fileName)

            uploadResults.push({
              url: urlData.publicUrl,
              fileName: fileName
            })
          }
        } catch (fileError) {
          console.error('File upload error:', fileError)
          // Continue with other files
        }
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

  // DELETE /api/upload/:fileName - Delete image from Supabase Storage
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

      const { error } = await supabase.storage
        .from('product-images')
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