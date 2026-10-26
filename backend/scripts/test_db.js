const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  'document_archive',
  'admin',
  'admin',
  {
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    logging: console.log
  }
);

async function test() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    const [result] = await sequelize.query('SELECT NOW() as time, current_database() as db');
    console.log('📅 Time:', result[0].time);
    console.log('💾 Database:', result[0].db);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

test();