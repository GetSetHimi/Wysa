declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        isAdmin?: boolean;
      };
    }
  }
}

export {};
