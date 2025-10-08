import express, { Request, Response } from 'express';
import { resourcePdfService } from '../Services/resourcePdfService';

const pdfController = express.Router();

// Generate study guide PDF
pdfController.post('/api/resources/study-guide', async (req: Request, res: Response) => {
  try {
    const { title, content, metadata } = req.body as {
      title: string;
      content: string;
      metadata?: {
        author?: string;
        difficulty?: 'beginner' | 'intermediate' | 'advanced';
        estimatedTime?: string;
        tags?: string[];
      };
    };

    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and content are required' 
      });
    }

    const fileName = await resourcePdfService.generateResourcePdf(
      title, 
      content, 
      'study-guide', 
      metadata
    );
    const downloadUrl = resourcePdfService.getPdfDownloadPath(fileName);

    return res.json({
      success: true,
      message: 'Study guide PDF generated successfully',
      data: {
        fileName,
        downloadUrl,
        title
      }
    });
  } catch (error) {
    console.error('Failed to generate study guide PDF:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Generate practice exercise PDF
pdfController.post('/api/resources/practice', async (req: Request, res: Response) => {
  try {
    const { title, exercises, answers } = req.body as {
      title: string;
      exercises: Array<{
        question: string;
        type: 'multiple-choice' | 'coding' | 'essay' | 'fill-blank';
        options?: string[];
        points?: number;
      }>;
      answers?: Array<{
        questionIndex: number;
        answer: string;
        explanation?: string;
      }>;
    };

    if (!title || !exercises || exercises.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and exercises are required' 
      });
    }

    const fileName = await resourcePdfService.generatePracticePdf(title, exercises, answers);
    const downloadUrl = resourcePdfService.getPdfDownloadPath(fileName);

    return res.json({
      success: true,
      message: 'Practice PDF generated successfully',
      data: {
        fileName,
        downloadUrl,
        title,
        exerciseCount: exercises.length
      }
    });
  } catch (error) {
    console.error('Failed to generate practice PDF:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Generate reference guide PDF
pdfController.post('/api/resources/reference', async (req: Request, res: Response) => {
  try {
    const { title, content, metadata } = req.body as {
      title: string;
      content: string;
      metadata?: {
        author?: string;
        difficulty?: 'beginner' | 'intermediate' | 'advanced';
        estimatedTime?: string;
        tags?: string[];
      };
    };

    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and content are required' 
      });
    }

    const fileName = await resourcePdfService.generateResourcePdf(
      title, 
      content, 
      'reference', 
      metadata
    );
    const downloadUrl = resourcePdfService.getPdfDownloadPath(fileName);

    return res.json({
      success: true,
      message: 'Reference guide PDF generated successfully',
      data: {
        fileName,
        downloadUrl,
        title
      }
    });
  } catch (error) {
    console.error('Failed to generate reference PDF:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// List all available resource PDFs
pdfController.get('/api/resources/list', async (req: Request, res: Response) => {
  try {
    const pdfFiles = await resourcePdfService.listResourcePdfs();
    
    return res.json({
      success: true,
      data: {
        files: pdfFiles,
        count: pdfFiles.length
      }
    });
  } catch (error) {
    console.error('Failed to list resource PDFs:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Download specific resource PDF
pdfController.get('/api/resources/download/:fileName', async (req: Request<{ fileName: string }>, res: Response) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName.endsWith('.pdf')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid file format' 
      });
    }

    const downloadUrl = resourcePdfService.getPdfDownloadPath(fileName);
    
    return res.json({
      success: true,
      data: {
        fileName,
        downloadUrl
      }
    });
  } catch (error) {
    console.error('Failed to get resource PDF download URL:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

export default pdfController;
