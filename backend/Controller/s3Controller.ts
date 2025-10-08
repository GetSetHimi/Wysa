import { Request, Response } from 'express';
import { s3Service } from '../Services/s3Service';
import { requireAuth } from '../middleware/authMiddleware';

export const s3Controller = require('express').Router();

// Upload single file
s3Controller.post('/api/upload/single', requireAuth, s3Service.getUploadMiddleware().single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const fileUrl = (req.file as any).location;
    const fileKey = s3Service.extractKeyFromUrl(fileUrl);

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl,
        fileKey,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

// Upload multiple files
s3Controller.post('/api/upload/multiple', requireAuth, s3Service.getUploadMiddleware().array('files', 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const uploadedFiles = files.map(file => ({
      fileUrl: (file as any).location,
      fileKey: s3Service.extractKeyFromUrl((file as any).location),
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype
    }));

    return res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length
      }
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload files'
    });
  }
});

// Get file by key
s3Controller.get('/api/file/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const file = await s3Service.getFile(key);
    
    res.set({
      'Content-Type': file.ContentType,
      'Content-Length': file.ContentLength?.toString(),
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`
    });

    return res.send(file.Body);
  } catch (error) {
    console.error('Error getting file:', error);
    return res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});

// Get signed URL for file access
s3Controller.get('/api/file/:key/url', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const expiresIn = parseInt(req.query.expires as string) || 3600;
    
    const signedUrl = await s3Service.getSignedUrl(key, expiresIn);
    
    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        expiresIn,
        fileKey: key
      }
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate signed URL'
    });
  }
});

// List files in folder
s3Controller.get('/api/files', requireAuth, async (req: Request, res: Response) => {
  try {
    const prefix = req.query.prefix as string || 'uploads';
    
    const files = await s3Service.listFiles(prefix);
    
    const fileList = files.map(file => ({
      key: file.Key,
      url: s3Service.getFileUrl(file.Key!),
      size: file.Size,
      lastModified: file.LastModified,
      etag: file.ETag
    }));

    return res.status(200).json({
      success: true,
      data: {
        files: fileList,
        count: fileList.length,
        prefix
      }
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list files'
    });
  }
});

// Get file metadata
s3Controller.get('/api/file/:key/metadata', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const metadata = await s3Service.getFileMetadata(key);
    
    return res.status(200).json({
      success: true,
      data: {
        key,
        contentType: metadata.ContentType,
        contentLength: metadata.ContentLength,
        lastModified: metadata.LastModified,
        etag: metadata.ETag,
        metadata: metadata.Metadata
      }
    });
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return res.status(404).json({
      success: false,
      message: 'File not found'
    });
  }
});

// Delete file
s3Controller.delete('/api/file/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const deleted = await s3Service.deleteFile(key);
    
    if (deleted) {
      return res.status(200).json({
        success: true,
        message: 'File deleted successfully',
        data: { key }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete file'
      });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

// Copy file
s3Controller.post('/api/file/:key/copy', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { destinationKey } = req.body;
    
    if (!destinationKey) {
      return res.status(400).json({
        success: false,
        message: 'Destination key is required'
      });
    }
    
    const newFileUrl = await s3Service.copyFile(key, destinationKey);
    
    return res.status(200).json({
      success: true,
      message: 'File copied successfully',
      data: {
        originalKey: key,
        newKey: destinationKey,
        newFileUrl
      }
    });
  } catch (error) {
    console.error('Error copying file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to copy file'
    });
  }
});

// Upload buffer (for programmatic uploads)
s3Controller.post('/api/upload/buffer', requireAuth, async (req: Request, res: Response) => {
  try {
    const { buffer, fileName, contentType, folder } = req.body;
    
    if (!buffer || !fileName || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'Buffer, fileName, and contentType are required'
      });
    }
    
    const bufferData = Buffer.from(buffer, 'base64');
    const fileUrl = await s3Service.uploadBuffer(
      bufferData, 
      fileName, 
      contentType, 
      folder || 'uploads'
    );
    
    const fileKey = s3Service.extractKeyFromUrl(fileUrl);
    
    return res.status(200).json({
      success: true,
      message: 'Buffer uploaded successfully',
      data: {
        fileUrl,
        fileKey,
        fileName,
        contentType
      }
    });
  } catch (error) {
    console.error('Error uploading buffer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload buffer'
    });
  }
});
