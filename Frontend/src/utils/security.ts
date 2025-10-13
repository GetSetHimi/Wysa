// Frontend Security Utilities

// 1. XSS Protection
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// 2. Secure Token Storage
export const secureTokenStorage = {
  setToken: (token: string): void => {
    try {
      localStorage.setItem('token', token);
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  },
  
  getToken: (): string | null => {
    try {
      return localStorage.getItem('token');
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  },
  
  removeToken: (): void => {
    try {
      localStorage.removeItem('token');
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  }
};

// 3. Input Validation
export const validateInput = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  },
  
  password: (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  },
  
  username: (username: string): boolean => {
    // 3-50 characters, alphanumeric, hyphens, underscores only
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return usernameRegex.test(username);
  },
  
  sanitize: (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  }
};

// 4. Secure API Calls
export const secureApiCall = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = secureTokenStorage.getToken();
  
  const secureOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: 'include',
  };

  try {
    const response = await fetch(url, secureOptions);
    
    // Handle security-related responses
    if (response.status === 401) {
      secureTokenStorage.removeToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    
    if (response.status === 403) {
      throw new Error('Access forbidden');
    }
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// 5. Content Security Policy Helper
export const cspHelper = {
  // Check if content is safe to display
  isSafeContent: (content: string): boolean => {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(content));
  },
  
  // Sanitize HTML content
  sanitizeHtml: (html: string): string => {
    // Simple HTML sanitization (use a proper library in production)
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  }
};

// 6. File Upload Security
export const fileUploadSecurity = {
  validateFile: (file: File): { isValid: boolean; error?: string } => {
    // Check file size (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      return { isValid: false, error: 'File size must be less than 15MB' };
    }
    
    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'Only PDF, DOC, and DOCX files are allowed' };
    }
    
    // Check file name
    const fileName = file.name;
    if (fileName.length > 255) {
      return { isValid: false, error: 'File name too long' };
    }
    
    // Check for dangerous characters in filename
    const dangerousChars = /[<>:"/\\|?*]/;
    if (dangerousChars.test(fileName)) {
      return { isValid: false, error: 'File name contains invalid characters' };
    }
    
    return { isValid: true };
  },
  
  sanitizeFileName: (fileName: string): string => {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }
};

// 7. Session Security
export const sessionSecurity = {
  // Check if session is still valid
  isSessionValid: (): boolean => {
    const token = secureTokenStorage.getToken();
    if (!token) return false;
    
    try {
      // Decode JWT token (client-side validation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        secureTokenStorage.removeToken();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Invalid token:', error);
      secureTokenStorage.removeToken();
      return false;
    }
  },
  
  // Auto-logout on inactivity
  setupInactivityLogout: (timeoutMinutes: number = 30): void => {
    let inactivityTimer: ReturnType<typeof setTimeout>;
    
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        if (sessionSecurity.isSessionValid()) {
          secureTokenStorage.removeToken();
          window.location.href = '/login';
        }
      }, timeoutMinutes * 60 * 1000);
    };
    
    // Reset timer on user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });
    
    resetTimer();
  }
};

// 8. Error Handling
export const secureErrorHandler = (error: any): string => {
  // Don't expose sensitive error information
  if (error.message?.includes('password') || error.message?.includes('token')) {
    return 'Authentication error. Please try again.';
  }
  
  if (error.message?.includes('database') || error.message?.includes('server')) {
    return 'Server error. Please try again later.';
  }
  
  // Generic error message for security
  return error.message || 'An error occurred. Please try again.';
};

// 9. Environment Security
export const environmentSecurity = {
  // Check if running in secure context
  isSecureContext: (): boolean => {
    return window.isSecureContext || location.protocol === 'https:';
  },
  
  // Validate environment variables
  validateEnv: (): boolean => {
    const requiredEnvVars = ['VITE_API_URL'];
    return requiredEnvVars.every(envVar => import.meta.env[envVar]);
  },
  
  // Get secure API URL
  getApiUrl: (): string => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      throw new Error('API URL not configured');
    }
    
    // Ensure HTTPS in production
    if (import.meta.env.PROD && !apiUrl.startsWith('https://')) {
      console.warn('⚠️ Using HTTP in production is not secure');
    }
    
    return apiUrl;
  }
};

// 10. Security Headers Helper
export const securityHeaders = {
  // Set security headers for fetch requests
  getSecureHeaders: (): HeadersInit => {
    return {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    };
  }
};
