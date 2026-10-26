import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// ✅ FIX: Add 'dialect' explicitly
const sequelize = new Sequelize(
  process.env.DB_NAME || 'document_archive',
  process.env.DB_USER || 'admin',
  process.env.DB_PASSWORD || 'admin123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres', // ← THIS IS REQUIRED!
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Define Department Model
const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  archiveLocation: {
    type: DataTypes.STRING(255),
    field: 'archive_location'
  }
}, {
  tableName: 'departments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'archivist', 'employee'),
    allowNull: false,
    defaultValue: 'employee'
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'department_id'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Password hashing (for setup)
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

// Define associations
Department.hasMany(User, { foreignKey: 'departmentId' });
User.belongsTo(Department, { foreignKey: 'departmentId' });

async function setupDatabase() {
  try {
    console.log('🔄 Starting database setup...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync database (force: true drops and recreates tables)
    console.log('📊 Creating tables...');
    await sequelize.sync({ force: true });
    console.log('✅ Tables created successfully!');

    // Create departments
    console.log('🏢 Creating departments...');
    const departments = await Department.bulkCreate([
      { name: 'Human Resources', description: 'HR Department - Employee records, policies' },
      { name: 'Finance', description: 'Finance Department - Invoices, reports' },
      { name: 'Legal', description: 'Legal Department - Contracts, agreements' },
      { name: 'IT', description: 'IT Department - System documentation' },
      { name: 'Sales & Marketing', description: 'Sales and Marketing Department' }
    ]);
    console.log(`✅ Created ${departments.length} departments`);

    // Hash passwords
    const adminPass = await hashPassword('Admin@123');
    const archivistPass = await hashPassword('Archivist@123');
    const employeePass = await hashPassword('Employee@123');

    // Create users
    console.log('👤 Creating users...');
    const users = await User.bulkCreate([
      {
        email: 'admin@documentarchive.com',
        passwordHash: adminPass,
        name: 'System Administrator',
        role: 'admin',
        isActive: true
      },
      {
        email: 'archivist@documentarchive.com',
        passwordHash: archivistPass,
        name: 'Chief Archivist',
        role: 'archivist',
        departmentId: departments[0].id,
        isActive: true
      },
      {
        email: 'employee@documentarchive.com',
        passwordHash: employeePass,
        name: 'Regular Employee',
        role: 'employee',
        departmentId: departments[1].id,
        isActive: true
      }
    ]);
    console.log(`✅ Created ${users.length} users`);

    console.log('\n========================================');
    console.log('🎉 DATABASE SETUP COMPLETE!');
    console.log('========================================');
    console.log('\n📋 Created Tables:');
    const tables = await sequelize.getQueryInterface().showAllTables();
    tables.forEach(table => {
      console.log(`  - ${table}`);
    });
    
    console.log('\n👤 Default Users:');
    console.log('  Admin:');
    console.log('    Email: admin@documentarchive.com');
    console.log('    Password: Admin@123');
    console.log('    Role: admin');
    console.log('\n  Archivist:');
    console.log('    Email: archivist@documentarchive.com');
    console.log('    Password: Archivist@123');
    console.log('    Role: archivist');
    console.log('\n  Employee:');
    console.log('    Email: employee@documentarchive.com');
    console.log('    Password: Employee@123');
    console.log('    Role: employee');
    console.log('\n========================================');
    console.log('🚀 Ready to start the backend server!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

// Run setup
setupDatabase();