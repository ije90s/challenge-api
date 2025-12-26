import 'dotenv/config';
import { DataSource } from 'typeorm';

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
      ? __dirname + '/**/entity/*.entity.js'
      : __dirname + '/**/entity/*.entity.ts',
  ],
  migrations: [
    isProd
      ? __dirname + '/migrations/*.js'
      : __dirname + '/migrations/*.ts',
  ],
});
