import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';

async function runSeeds(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('📊 Database connected');

    const seedPath = path.resolve(process.cwd(), 'src/database/seeds/seed.sql');
    if (!fs.existsSync(seedPath)) {
      console.log('⚠️  No seed.sql found at', seedPath);
      await AppDataSource.destroy();
      return;
    }

    const sql = fs.readFileSync(seedPath, 'utf8');
    await AppDataSource.query(sql);
    console.log('✅ Seeds executed successfully');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Seed error:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

void runSeeds();
