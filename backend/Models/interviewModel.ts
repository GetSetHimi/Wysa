import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';

type InterviewStatus = 'pending' | 'completed';

interface InterviewAttributes {
  id: number;
  userId: number;
  plannerId?: number | null;
  scheduledAt: Date;
  status?: InterviewStatus;
  recordingUrl?: string | null;
  transcript?: string | null;
  scoreJson?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type InterviewCreationAttributes = Optional<
  InterviewAttributes,
  'id' | 'plannerId' | 'status' | 'recordingUrl' | 'transcript' | 'scoreJson' | 'createdAt' | 'updatedAt'
>;

class Interview extends Model<InterviewAttributes, InterviewCreationAttributes> implements InterviewAttributes {
  public id!: number;
  public userId!: number;
  public plannerId?: number | null;
  public scheduledAt!: Date;
  public status?: InterviewStatus;
  public recordingUrl?: string | null;
  public transcript?: string | null;
  public scoreJson?: Record<string, unknown> | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

Interview.init(
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
    plannerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'planners',
        key: 'id',
      },
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed'),
      defaultValue: 'pending',
    },
    recordingUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transcript: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    scoreJson: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'interviews',
    modelName: 'Interview',
  }
);

export default Interview;
