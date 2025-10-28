import User from './UserModel';
import Profile from './profileModel';
import Resume, { ResumeCreationAttributes, ResumeAttributes } from './ResumeModel';
import Planner from './plannerModel';
import Interview from './interviewModel';
import Notification, { NotificationCreationAttributes } from './notificationModel';
import Resource from './resourceModel';
import UserActivity from './UserActivityModel';

// Define associations
User.hasOne(Profile, { foreignKey: 'userId', as: 'Profile' });
Profile.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Resume, { foreignKey: 'userId', as: 'Resumes' });
Resume.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Planner, { foreignKey: 'userId', as: 'Planners' });
Planner.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Interview, { foreignKey: 'userId', as: 'Interviews' });
Interview.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'Notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'User' });

User.hasMany(Resource, { foreignKey: 'userId', as: 'Resources' });
Resource.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Planner.hasMany(Interview, { foreignKey: 'plannerId', as: 'Interviews' });
Interview.belongsTo(Planner, { foreignKey: 'plannerId', as: 'Planner' });

User.hasMany(UserActivity, { foreignKey: 'userId', as: 'Activities' });
UserActivity.belongsTo(User, { foreignKey: 'userId', as: 'User' });

export {
  User,
  Profile,
  Resume,
  ResumeAttributes,
  ResumeCreationAttributes,
  Planner,
  Interview,
  Notification,
  NotificationCreationAttributes,
  Resource,
  UserActivity
};
