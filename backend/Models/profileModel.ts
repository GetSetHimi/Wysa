import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';


// Define the attributes interface
interface ProfileAttributes {
  id: number;
  userId: number;
  desiredRole: string;
  weeklyHours: number;
  timezone?: string | null;
  preferences?: Record<string, unknown> | null;
  // Extended profile fields
  name?: string | null;
  phone?: string | null;
  currentRole?: string | null;
  experienceYears?: number | null;
  skills?: string[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}



type ProfileCreationAttributes = Optional<ProfileAttributes, 'id' | 'createdAt' | 'updatedAt'>;

class Profile extends Model<ProfileAttributes, ProfileCreationAttributes> implements ProfileAttributes {
  public id!: number;
  public userId!: number;
  public desiredRole!: string;
  public weeklyHours!: number;
  public timezone?: string | null;
  public preferences?: Record<string, unknown> | null;
  public name?: string | null;
  public phone?: string | null;
  public currentRole?: string | null;
  public experienceYears?: number | null;
  public skills?: string[] | null;
  public createdAt?: Date;
  public updatedAt?: Date;
}

Profile.init(
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
    desiredRole: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    weeklyHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currentRole: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'currentrole', // Map to actual database column
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'experienceyears', // Map to actual database column
    },
    skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
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
    tableName: 'profiles',
    modelName: 'Profile',
  }
);

export default Profile;