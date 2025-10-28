import bcrypt from 'bcrypt';
import { User } from '../Models';
import logger from '../Services/logger';

export class AdminSetupService {
  /**
   * Create or update admin user from environment variables
   */
  static async setupAdminUser(): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminUsername = process.env.ADMIN_USERNAME || 'Admin';

      if (!adminEmail || !adminPassword) {
        logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not configured in environment variables');
        return;
      }

      // Check if admin user already exists
      let adminUser = await User.findOne({ where: { email: adminEmail.toLowerCase() } });

      if (adminUser) {
        // Update existing admin user password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        adminUser.password = hashedPassword;
        adminUser.username = adminUsername;
        await adminUser.save();
        
        logger.info(`✅ Admin user updated: ${adminEmail}`);
      } else {
        // Create new admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        adminUser = await User.create({
          username: adminUsername,
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          age: 25, // Default age
        });
        
        logger.info(`✅ Admin user created: ${adminEmail}`);
      }

      logger.info(`🔐 Admin credentials configured:`);
      logger.info(`   Email: ${adminEmail}`);
      logger.info(`   Username: ${adminUsername}`);
      logger.info(`   Password: [CONFIGURED]`);

    } catch (error) {
      logger.error('❌ Failed to setup admin user:', error);
    }
  }

  /**
   * Verify admin user exists and credentials are correct
   */
  static async verifyAdminUser(): Promise<boolean> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminEmail || !adminPassword) {
        logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not configured');
        return false;
      }

      const adminUser = await User.findOne({ where: { email: adminEmail.toLowerCase() } });
      
      if (!adminUser) {
        logger.warn(`Admin user not found: ${adminEmail}`);
        return false;
      }

      const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password);
      
      if (!isPasswordValid) {
        logger.warn(`Admin password verification failed for: ${adminEmail}`);
        return false;
      }

      logger.info(`✅ Admin user verified: ${adminEmail}`);
      return true;

    } catch (error) {
      logger.error('❌ Failed to verify admin user:', error);
      return false;
    }
  }

  /**
   * Get admin user info (without password)
   */
  static async getAdminInfo(): Promise<{ email: string; username: string } | null> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      
      if (!adminEmail) {
        return null;
      }

      const adminUser = await User.findOne({ 
        where: { email: adminEmail.toLowerCase() },
        attributes: ['email', 'username']
      });
      
      if (!adminUser) {
        return null;
      }

      return {
        email: adminUser.email,
        username: adminUser.username
      };

    } catch (error) {
      logger.error('❌ Failed to get admin info:', error);
      return null;
    }
  }
}
