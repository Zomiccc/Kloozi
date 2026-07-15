const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|mov|avi|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

async function uploadToS3(file, folder = 'uploads') {
  const fileName = `${folder}/${crypto.randomUUID()}-${file.originalname.replace(/\s/g, '-')}`;
  const params = {
    Bucket: config.aws.s3Bucket,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
  };

  const result = await s3.upload(params).promise();
  return {
    url: result.Location,
    key: result.Key,
    bucket: result.Bucket,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
  };
}

async function deleteFromS3(key) {
  const params = {
    Bucket: config.aws.s3Bucket,
    Key: key,
  };
  await s3.deleteObject(params).promise();
}

function generateSignedUrl(key, expiresIn = 3600) {
  const params = {
    Bucket: config.aws.s3Bucket,
    Key: key,
    Expires: expiresIn,
  };
  return s3.getSignedUrl('getObject', params);
}

module.exports = { upload, uploadToS3, deleteFromS3, generateSignedUrl, s3 };
