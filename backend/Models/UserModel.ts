import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';

// Define the attributes interface
interface UserAttributes {
  id: number;
  username: string;
  age: number;
  password: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define creation attributes (optional id since it's auto-generated)
type UserCreationAttributes = Optional<UserAttributes, 'id'>

// Define the User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public age!: number;
  public password!: string;
  public email!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 18,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
  },
  {
    sequelize,
    tableName: 'users',
    modelName: 'User',
    timestamps: true,
  }
);

export default User;