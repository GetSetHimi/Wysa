import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';

interface PlannerAttributes {
  id: number;
  userId: number;
  role: string;
  startDate: Date;
  endDate: Date;
  planJson?: Record<string, unknown> | null;
  progressPercent?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type PlannerCreationAttributes = Optional<
  PlannerAttributes,
  'id' | 'planJson' | 'progressPercent' | 'createdAt' | 'updatedAt'
>;

class Planner extends Model<PlannerAttributes, PlannerCreationAttributes> implements PlannerAttributes {
  public id!: number;
  public userId!: number;
  public role!: string;
  public startDate!: Date;
  public endDate!: Date;
  public planJson?: Record<string, unknown> | null;
  public progressPercent?: number;
  public createdAt?: Date;
  public updatedAt?: Date;
}

Planner.init(
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
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    planJson: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    progressPercent: {
      type: DataTypes.FLOAT,
      defaultValue: 0.0,
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
    tableName: 'planners',
    modelName: 'Planner',
  }
);

export default Planner;
