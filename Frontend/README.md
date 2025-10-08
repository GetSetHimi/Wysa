# AI Career Coach - Frontend

A comprehensive React frontend for the AI Career Coach application, built with modern web technologies and best practices.

## Features

- **Authentication**: Secure login/signup with JWT tokens
- **Dashboard**: Overview of learning progress and today's tasks
- **Resume Analysis**: AI-powered resume upload and analysis
- **Learning Planner**: Personalized daily learning plans
- **Task Management**: Track and complete daily learning tasks
- **Mock Interviews**: Schedule and participate in AI-powered voice interviews
- **Resource Management**: Create and download study materials
- **Profile Management**: User preferences and career goals

## Tech Stack

- **React 19** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Hook Form** - Form handling
- **Axios** - HTTP client
- **React Hot Toast** - Notifications
- **Lucide React** - Beautiful icons
- **Date-fns** - Date utilities
- **React Dropzone** - File uploads

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update environment variables:
```env
VITE_API_URL=http://localhost:3000
```

4. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Layout.tsx      # Main layout with navigation
│   └── ProtectedRoute.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication context
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Profile.tsx
│   ├── ResumeUpload.tsx
│   ├── Planner.tsx
│   ├── Tasks.tsx
│   ├── Interview.tsx
│   └── Resources.tsx
├── services/           # API services
│   └── api.ts
├── App.tsx             # Main app component
└── main.tsx           # Entry point
```

## Key Features

### Authentication
- Secure JWT-based authentication
- Protected routes
- Automatic token refresh
- Logout functionality

### Dashboard
- Progress overview
- Today's tasks summary
- Quick action buttons
- Statistics cards

### Resume Analysis
- Drag & drop file upload
- AI-powered analysis
- Skill gap detection
- Downloadable PDF reports

### Learning Planner
- AI-generated learning plans
- Progress tracking
- PDF generation
- Task management

### Mock Interviews
- Eligibility checking
- Interview scheduling
- Voice call integration
- Results and feedback

### Resources
- Study guide creation
- Practice exercises
- Reference materials
- PDF generation

## API Integration

The frontend integrates with the backend API through a centralized service layer:

- **Auth API**: Login, signup, user management
- **Profile API**: User preferences and settings
- **Resume API**: File upload and analysis
- **Planner API**: Learning plan generation
- **Task API**: Task management and completion
- **Interview API**: Mock interview scheduling
- **Notification API**: Daily plans and reminders
- **PDF API**: Resource generation

## Styling

The application uses Tailwind CSS for styling with:
- Responsive design
- Dark/light mode support
- Consistent color scheme
- Modern UI components
- Accessibility features

## State Management

- React Context for global state (authentication)
- Local state for component-specific data
- Form state with React Hook Form
- API state management with Axios

## Error Handling

- Global error boundaries
- API error handling
- User-friendly error messages
- Loading states
- Toast notifications

## Performance

- Code splitting with React Router
- Lazy loading for heavy components
- Optimized bundle size
- Efficient re-renders
- Image optimization

## Development

### Code Quality
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Component-based architecture

### Testing
- Unit tests for utilities
- Integration tests for API calls
- Component testing with React Testing Library

## Deployment

The application can be deployed to:
- Vercel (recommended)
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.