import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';

type NotificationType = 'daily_plan' | 'interview' | 'reminder';

interface NotificationAttributes {
  id: number;
  userId: number;
  type: NotificationType;
  message: string;
  read: boolean;
  payload?: Record<string, unknown> | null;
  sentAt?: Date;
}

type NotificationCreationAttributes = Optional<NotificationAttributes, 'id' | 'payload' | 'sentAt'>;

class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  public id!: number;
  public userId!: number;
  public type!: NotificationType;
  public message!: string;
  public read!: boolean;
  public payload?: Record<string, unknown> | null;
  public sentAt?: Date;
}

Notification.init(
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
    type: {
      type: DataTypes.ENUM('daily_plan', 'interview', 'reminder'),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    modelName: 'Notification',
    timestamps: false,
  }
);

export default Notification;
export { NotificationCreationAttributes };
