import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { Request } from 'express';

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

export class S3Service {
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || 'wysa-interview-files';
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Configure multer for S3 uploads
   */
  getUploadMiddleware() {
    return multer({
      storage: multerS3({
        s3: s3 as any,
        bucket: this.bucketName,
        key: (req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const fileName = `${uniqueSuffix}-${file.originalname}`;
          cb(null, `uploads/${fileName}`);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void) => {
          cb(null, {
            fieldName: file.fieldname,
            originalName: file.originalname,
            uploadedBy: (req as any).user?.id || 'anonymous',
            uploadDate: new Date().toISOString()
          });
        }
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/jpeg',
          'image/png'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, JPG, and PNG files are allowed.'));
        }
      }
    });
  }

  /**
   * Upload file to S3
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileName = `${uniqueSuffix}-${file.originalname}`;
      const key = `${folder}/${fileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadDate: new Date().toISOString()
        }
      };

      const result = await s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  /**
   * Upload buffer to S3
   */
  async uploadBuffer(
    buffer: Buffer, 
    fileName: string, 
    contentType: string, 
    folder: string = 'uploads'
  ): Promise<string> {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const key = `${folder}/${uniqueSuffix}-${fileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          originalName: fileName,
          uploadDate: new Date().toISOString()
        }
      };

      const result = await s3.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      console.error('Error uploading buffer to S3:', error);
      throw new Error('Failed to upload buffer to S3');
    }
  }

  /**
   * Get file from S3
   */
  async getFile(key: string): Promise<AWS.S3.GetObjectOutput> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      return await s3.getObject(params).promise();
    } catch (error) {
      console.error('Error getting file from S3:', error);
      throw new Error('Failed to get file from S3');
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      await s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      return false;
    }
  }

  /**
   * Generate signed URL for file access
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn
      };

      return await s3.getSignedUrl('getObject', params);
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(prefix: string = 'uploads'): Promise<AWS.S3.Object[]> {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix
      };

      const result = await s3.listObjectsV2(params).promise();
      return result.Contents || [];
    } catch (error) {
      console.error('Error listing files from S3:', error);
      throw new Error('Failed to list files from S3');
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      return await s3.headObject(params).promise();
    } catch (error) {
      console.error('Error getting file metadata from S3:', error);
      throw new Error('Failed to get file metadata from S3');
    }
  }

  /**
   * Copy file within S3
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    try {
      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      };

      await s3.copyObject(copyParams).promise();
      return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${destinationKey}`;
    } catch (error) {
      console.error('Error copying file in S3:', error);
      throw new Error('Failed to copy file in S3');
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Extract key from S3 URL
   */
  extractKeyFromUrl(url: string): string {
    const urlParts = url.split('/');
    return urlParts.slice(3).join('/'); // Remove https://bucket.s3.region.amazonaws.com/
  }
}

// Export singleton instance
export const s3Service = new S3Service();
