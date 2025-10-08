# Deployment Guide: Backend on Render & Frontend on Netlify

This guide will help you deploy your Wysa application with the backend on Render and frontend on Netlify.

## Prerequisites

- GitHub repository with your code
- Render account (free tier available)
- Netlify account (free tier available)
- Database (PostgreSQL recommended - Neon, Supabase, or Render PostgreSQL)

## Backend Deployment on Render

### 1. Prepare Your Backend

The following files have been created for Render deployment:
- `render.yaml` - Render service configuration
- `Dockerfile` - Container configuration
- `.dockerignore` - Files to exclude from Docker build

### 2. Deploy to Render

1. **Connect Repository:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder as the root directory

2. **Configure Service:**
   - **Name:** `wysa-backend` (or your preferred name)
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or paid for production)

3. **Set Environment Variables:**
   Go to Environment tab and add these variables:

   **Database Configuration:**
   ```
   DB_HOST=your_database_host
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   ```

   **JWT Configuration:**
   ```
   JWT_SECRET=your_very_secure_jwt_secret_key
   JWT_EXPIRES_IN=7d
   ```

   **Server Configuration:**
   ```
   NODE_ENV=production
   PORT=10000
   BACKEND_URL=https://your-app-name.onrender.com
   FRONTEND_URL=https://your-netlify-app.netlify.app
   ```

   **API Keys (get from respective services):**
   ```
   VAPI_PRIVATE_KEY=your_vapi_private_key
   VAPI_PUBLIC_KEY=your_vapi_public_key
   VAPI_WEBHOOK_SECRET=your_webhook_secret
   GEMINI_API_KEY=your_gemini_api_key
   ```

   **AWS S3 Configuration:**
   ```
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=your_s3_bucket_name
   ```

   **Email Configuration:**
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

   **Security Configuration:**
   ```
   BCRYPT_ROUNDS=12
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

4. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy your application
   - Note the URL (e.g., `https://your-app-name.onrender.com`)

## Frontend Deployment on Netlify

### 1. Prepare Your Frontend

The following files have been created for Netlify deployment:
- `netlify.toml` - Netlify configuration
- `_redirects` - SPA routing configuration
- `env.example` - Environment variables template

### 2. Deploy to Netlify

1. **Connect Repository:**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository
   - Select the `Frontend` folder as the base directory

2. **Configure Build Settings:**
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
   - **Node Version:** 18

3. **Set Environment Variables:**
   Go to Site settings → Environment variables and add:
   ```
   VITE_API_URL=https://your-backend-app.onrender.com
   ```

4. **Deploy:**
   - Click "Deploy site"
   - Netlify will build and deploy your application
   - Note the URL (e.g., `https://your-app-name.netlify.app`)

## Post-Deployment Configuration

### 1. Update Backend CORS Settings

After getting your Netlify URL, update the backend environment variable:
```
FRONTEND_URL=https://your-netlify-app.netlify.app
```

### 2. Update Frontend API URL

Update the frontend environment variable in Netlify:
```
VITE_API_URL=https://your-backend-app.onrender.com
```

### 3. Test the Deployment

1. **Backend Health Check:**
   - Visit: `https://your-backend-app.onrender.com`
   - Should return: `{"status":"ok","timestamp":"...","environment":"production"}`

2. **Frontend:**
   - Visit: `https://your-netlify-app.netlify.app`
   - Should load your React application

3. **API Connection:**
   - Try logging in or making API calls
   - Check browser console for any CORS errors

## Database Setup

### Option 1: Neon (Recommended)
1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string
4. Use the connection details in your Render environment variables

### Option 2: Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection details

### Option 3: Render PostgreSQL
1. In Render dashboard, create a new PostgreSQL service
2. Use the provided connection details

## Troubleshooting

### Common Issues:

1. **Build Failures:**
   - Check build logs in Render/Netlify
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

2. **CORS Errors:**
   - Ensure FRONTEND_URL is set correctly in backend
   - Check that the frontend URL matches exactly

3. **Database Connection:**
   - Verify database credentials
   - Check if database allows connections from Render's IPs
   - Ensure SSL is configured if required

4. **Environment Variables:**
   - Double-check all required variables are set
   - Ensure no typos in variable names
   - Restart services after adding new variables

### Performance Optimization:

1. **Render Free Tier Limitations:**
   - Services sleep after 15 minutes of inactivity
   - Consider upgrading to paid plan for production

2. **Netlify Optimizations:**
   - Enable asset optimization
   - Use CDN for static assets
   - Implement proper caching headers

## Security Considerations

1. **Environment Variables:**
   - Never commit `.env` files to git
   - Use strong, unique secrets
   - Rotate keys regularly

2. **CORS Configuration:**
   - Only allow your frontend domain
   - Use HTTPS in production

3. **Database Security:**
   - Use strong passwords
   - Enable SSL connections
   - Restrict database access

## Monitoring and Logs

1. **Render:**
   - Check logs in the Render dashboard
   - Monitor service health and performance

2. **Netlify:**
   - Check build logs and function logs
   - Monitor site analytics

## Next Steps

1. Set up custom domains (optional)
2. Configure SSL certificates (automatic with both platforms)
3. Set up monitoring and alerting
4. Implement CI/CD for automatic deployments
5. Consider upgrading to paid plans for production use

## Support

- [Render Documentation](https://render.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [Vite Documentation](https://vitejs.dev/guide/)
- [Express.js Documentation](https://expressjs.com/)
