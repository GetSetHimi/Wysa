import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';

export interface ResourceAttributes {
  id: number;
  userId: number;
  title: string;
  description: string;
  resourceType: 'video' | 'article' | 'course' | 'book' | 'tool' | 'other';
  url?: string;
  content?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  completed: boolean;
  completedAt?: Date;
  rating?: number;
  notes?: string;
  source: 'ai_generated' | 'user_added' | 'recommended';
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceCreationAttributes extends Optional<ResourceAttributes, 'id' | 'completed' | 'completedAt' | 'rating' | 'notes' | 'metadata' | 'createdAt' | 'updatedAt'> {}

class Resource extends Model<ResourceAttributes, ResourceCreationAttributes> implements ResourceAttributes {
  public id!: number;
  public userId!: number;
  public title!: string;
  public description!: string;
  public resourceType!: 'video' | 'article' | 'course' | 'book' | 'tool' | 'other';
  public url?: string;
  public content?: string;
  public tags!: string[];
  public difficulty!: 'beginner' | 'intermediate' | 'advanced';
  public estimatedHours!: number;
  public completed!: boolean;
  public completedAt?: Date;
  public rating?: number;
  public notes?: string;
  public source!: 'ai_generated' | 'user_added' | 'recommended';
  public metadata?: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Resource.init(
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    resourceType: {
      type: DataTypes.ENUM('video', 'article', 'course', 'book', 'tool', 'other'),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    difficulty: {
      type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
      allowNull: false,
    },
    estimatedHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5,
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.ENUM('ai_generated', 'user_added', 'recommended'),
      allowNull: false,
      defaultValue: 'ai_generated',
    },
    metadata: {
      type: DataTypes.JSONB,
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
    tableName: 'resources',
    modelName: 'Resource',
  }
);

export default Resource;
