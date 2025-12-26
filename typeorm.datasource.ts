import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';

const isProd = process.env.NODE_ENV === 'prod';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT!),
  username: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  database: process.env.DB_NAME!,
  entities: [
    isProd
      ? join(__dirname, 'src/**/entity/*.entity.js')   
      : join(__dirname, 'src/**/entity/*.entity.ts'),
  ],
  migrations: [
    isProd
      ? join(__dirname, 'src/migrations/*.js')
      : join(__dirname, 'src/migrations/*.ts'),
  ],
});
