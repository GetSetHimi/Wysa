import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../Database';


export interface ResumeAttributes {
    id: number;
    userId: number;
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    fileSize: number;
    parsedJson?: Record<string, unknown> | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export type ResumeCreationAttributes = Optional<
    ResumeAttributes,
    'id' | 'parsedJson' | 'createdAt' | 'updatedAt'
>;


class Resume extends Model<ResumeAttributes, ResumeCreationAttributes> implements ResumeAttributes {
  public id!: number;
  public userId!: number;
    public originalFileName!: string;
    public storedFileName!: string;
    public mimeType!: string;
    public fileSize!: number;
    public parsedJson?: Record<string, unknown> | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Resume.init(
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
        originalFileName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        storedFileName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mimeType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        fileSize: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        parsedJson: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
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
        tableName: 'resumes',
        modelName: 'Resume',
    }
);

export default Resume;