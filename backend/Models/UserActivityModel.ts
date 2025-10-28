import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';

// Define the attributes interface
interface UserActivityAttributes {
  id: number;
  userId: number;
  lastActiveAt: Date;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define creation attributes
type UserActivityCreationAttributes = Optional<UserActivityAttributes, 'id' | 'createdAt' | 'updatedAt'>;

// Define the UserActivity model class
class UserActivity extends Model<UserActivityAttributes, UserActivityCreationAttributes> implements UserActivityAttributes {
  public id!: number;
  public userId!: number;
  public lastActiveAt!: Date;
  public sessionId?: string | null;
  public ipAddress?: string | null;
  public userAgent?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
UserActivity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user_activities',
    modelName: 'UserActivity',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['lastActiveAt'],
      },
    ],
  }
);

export default UserActivity;
