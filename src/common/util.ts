import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const UPLOADS_ROOT_DIR = path.join(__dirname, '..', 'uploads');

const createFolder = (folder: string) => {
  try {
    console.log('💾 Create a root uploads folder...');
    fs.mkdirSync(UPLOADS_ROOT_DIR);
  } catch (error) {
    console.log('The folder already exists...');
  }
  try {
    console.log(`💾 Create a ${folder} uploads folder...`);
    fs.mkdirSync(path.join(UPLOADS_ROOT_DIR, folder));
  } catch (error) {
    console.log(`The ${folder} folder already exists...`);
  }
};

const storage = (folder: string): multer.StorageEngine => {
  createFolder(folder);
  return multer.diskStorage({
    destination(req, file, cb) {
      //* 어디에 저장할 지
      const folderName = path.join(UPLOADS_ROOT_DIR, folder);
      cb(null, folderName);
    },
    filename(req, file, cb) {
      //* 어떤 이름으로 올릴 지
      const ext = path.extname(file.originalname);

      const fileName = `${path.basename(
        file.originalname,
        ext,
      )}${Date.now()}${ext}`;

      cb(null, fileName);
    },
  });
};

export const multerOptions = (folder: string) => {
  const result: MulterOptions = {
    storage: storage(folder),
    
    // 파일 크기 제한
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },

    // 파일 형식 제한
    fileFilter: (req, file, callback) => {
      const allowedExt = ['.jpg', '.jpeg', '.png'];
      const ext = path.extname(file.originalname).toLowerCase();

      if (!allowedExt.includes(ext)) {
        return callback(new Error('INVALID_FILE_TYPE'), false);
      }

      callback(null, true);
    },
  };

  return result;
};

// 날짜 입력값 확인
export const checkDate = (startDate: Date, endDate: Date): boolean => {
  const newStartDate: Date = startDate;
  const newEndDate: Date = endDate; 
  const today = new Date();

  // 날짜 형식 체크
  if (isNaN(newStartDate.getTime()) || isNaN(newEndDate.getTime())) {
    return false;
  }

  // 시작일 < 종료일
  if (newStartDate >= newEndDate) {
    return false;
  }

  return true;
};

// 날짜 지났는지 확인
export const checkThePast = (strday: Date): boolean => {
  const today = new Date();
  const inputDay: Date = strday; 

  return inputDay > today;

};
