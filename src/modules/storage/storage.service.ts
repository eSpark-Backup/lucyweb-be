import { Injectable, BadRequestException } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';

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
}
