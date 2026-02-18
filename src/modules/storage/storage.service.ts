import { Injectable, BadRequestException } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { Readable } from 'stream';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class StorageService {
  private readonly s3: AWS.S3;
  private readonly bucketName: string;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    this.bucketName = process.env.S3_BUCKET_NAME || '';
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf'];
    const fileExt = extname(file.originalname).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      throw new BadRequestException('Invalid file type.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'File size exceeds the allowed limit of 10MB.',
      );
    }

    const fileName = `${uuid()}${fileExt}`;

    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      const data = await this.s3.upload(params).promise();
      return data.Location; // Return URL of the uploaded file
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('An error occurred while uploading the file.');
    }
  }
  async deleteFileFromUrl(fileUrl: string): Promise<void> {
    const key = fileUrl.split('/').pop(); // assuming simple path
    await this.s3.deleteObject({ Bucket: this.bucketName, Key: key }).promise();
  }
  async getFileStream(fileKey: string): Promise<Readable> {
    if (!fileKey) {
      throw new BadRequestException('File key is required');
    }

    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileKey,
      };
      const s3Object = this.s3.getObject(params).createReadStream();
      return s3Object;
    } catch (error) {
      console.error('Error fetching file from S3:', error);
      throw new BadRequestException('Unable to fetch file from S3');
    }
  }

  extractKeyFromUrl(fileUrl: string): string | null {
    if (!fileUrl) return null;

    try {
      const url = new URL(fileUrl);
      // Check if URL belongs to the configured S3 bucket
      if (!url.hostname.includes(this.bucketName)) {
        return null; // Not from our bucket
      }
      // Extract the key from the pathname (remove leading /)
      const key = url.pathname.substring(1);
      return key || null;
    } catch {
      return null; // Invalid URL
    }
  }

  isS3Url(fileUrl: string): boolean {
    if (!fileUrl) return false;

    try {
      const url = new URL(fileUrl);
      return url.hostname.includes(this.bucketName);
    } catch {
      return false;
    }
  }

  async downloadExternalFile(fileUrl: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(fileUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        protocol.get(fileUrl, (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(
              new BadRequestException(
                `Failed to download file from ${fileUrl}: HTTP ${response.statusCode}`,
              ),
            );
            return;
          }
          resolve(response as Readable);
        });
      } catch (error) {
        console.error(`Error downloading external file ${fileUrl}:`, error);
        reject(
          new BadRequestException(`Unable to download file from ${fileUrl}`),
        );
      }
    });
  }

  extractFilenameFromUrl(fileUrl: string): string {
    try {
      const url = new URL(fileUrl);
      const pathname = url.pathname;
      const filename =
        pathname.substring(pathname.lastIndexOf('/') + 1) || 'file';
      return filename || 'file';
    } catch {
      return `file-${Date.now()}`;
    }
  }
}
