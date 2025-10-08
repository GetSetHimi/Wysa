import axios from 'axios';

export interface VAPIWorkflowConfig {
  userId: number;
  plannerId: number;
  role: string;
  learningModules: string[];
  userEmail: string;
  userName: string;
  scheduledAt: Date;
}

export interface VAPIEvaluationResult {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  domainKnowledgeScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedFeedback: string;
}

export class VAPIWorkflowService {
  private readonly VAPI_BASE_URL = 'https://api.vapi.ai';
  private readonly VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;
  private readonly VAPI_PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY;

  /**
   * Create VAPI workflow for 45-minute deep dive interview
   */
  async createInterviewWorkflow(config: VAPIWorkflowConfig): Promise<string> {
    try {
      const workflow = this.generateInterviewWorkflow(config);
      
      const response = await axios.post(
        `${this.VAPI_BASE_URL}/assistant`,
        workflow,
        {
          headers: {
            'Authorization': `Bearer ${this.VAPI_PRIVATE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('VAPI workflow created successfully:', response.data.id);
      return response.data.id;
    } catch (error) {
      console.error('Failed to create VAPI workflow:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive interview workflow JSON
   */
  private generateInterviewWorkflow(config: VAPIWorkflowConfig): any {
    return {
      name: `Deep Dive Interview - ${config.role}`,
      model: {
        provider: "google",
        model: "gemini-1.5-flash",
        temperature: 0.7,
        maxTokens: 4000
      },
      voice: {
        provider: "elevenlabs",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Professional female voice
        speed: 1.0,
        stability: 0.5,
        clarity: 0.75
      },
      firstMessage: `Hello ${config.userName}! Welcome to your comprehensive ${config.role} interview. I'm your AI interviewer, and I'll be conducting a 45-minute deep dive into your technical skills and knowledge. Let's begin with a brief introduction from you.`,
      systemMessage: this.generateSystemMessage(config),
      endCallMessage: "Thank you for your time! Your interview has been completed. We'll analyze your responses and provide detailed feedback within 24 hours.",
      endCallPhrases: ["end call", "finish interview", "that's all", "thank you"],
      recordingEnabled: true,
      voicemailDetectionEnabled: true,
      backgroundSound: "office",
      maxDurationSeconds: 2700, // 45 minutes
      interruptionThreshold: 500,
      responseDelaySeconds: 1,
      llmRequestDelaySeconds: 0.5,
      numWordsToInterrupt: 3,
      backchannelingEnabled: true,
      fillersEnabled: true,
      silenceTimeoutSeconds: 30,
      maxSilenceSeconds: 10,
      endCallFunctionEnabled: true,
      functions: [
        {
          name: "evaluate_response",
          description: "Evaluate the candidate's response to a technical question",
          parameters: {
            type: "object",
            properties: {
              questionType: {
                type: "string",
                enum: ["technical", "behavioral", "problem_solving", "domain_knowledge", "communication"]
              },
              responseQuality: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Quality of response from 1-10"
              },
              technicalAccuracy: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Technical accuracy from 1-10"
              },
              communicationClarity: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Communication clarity from 1-10"
              },
              problemSolvingApproach: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Problem solving approach from 1-10"
              },
              strengths: {
                type: "array",
                items: { type: "string" },
                description: "Identified strengths in the response"
              },
              weaknesses: {
                type: "array",
                items: { type: "string" },
                description: "Areas for improvement"
              },
              followUpQuestions: {
                type: "array",
                items: { type: "string" },
                description: "Suggested follow-up questions"
              }
            },
            required: ["questionType", "responseQuality", "technicalAccuracy", "communicationClarity", "problemSolvingApproach"]
          }
        },
        {
          name: "final_evaluation",
          description: "Provide final comprehensive evaluation of the candidate",
          parameters: {
            type: "object",
            properties: {
              overallScore: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Overall interview score"
              },
              technicalScore: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Technical knowledge score"
              },
              communicationScore: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Communication skills score"
              },
              problemSolvingScore: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Problem solving ability score"
              },
              domainKnowledgeScore: {
                type: "number",
                minimum: 1,
                maximum: 10,
                description: "Domain-specific knowledge score"
              },
              strengths: {
                type: "array",
                items: { type: "string" },
                description: "Key strengths identified"
              },
              weaknesses: {
                type: "array",
                items: { type: "string" },
                description: "Areas needing improvement"
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "Specific recommendations for improvement"
              },
              detailedFeedback: {
                type: "string",
                description: "Comprehensive feedback on performance"
              },
              hireRecommendation: {
                type: "string",
                enum: ["strong_hire", "hire", "maybe", "no_hire"],
                description: "Hiring recommendation"
              }
            },
            required: ["overallScore", "technicalScore", "communicationScore", "problemSolvingScore", "domainKnowledgeScore", "strengths", "weaknesses", "recommendations", "detailedFeedback", "hireRecommendation"]
          }
        }
      ],
      serverUrl: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/interview/webhook`,
      serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET || 'your-webhook-secret'
    };
  }

  /**
   * Generate comprehensive system message for the interview
   */
  private generateSystemMessage(config: VAPIWorkflowConfig): string {
    return `You are an expert technical interviewer conducting a comprehensive 45-minute deep dive interview for a ${config.role} position. 

CANDIDATE INFORMATION:
- Name: ${config.userName}
- Role: ${config.role}
- Learning Modules Completed: ${config.learningModules.join(', ')}

INTERVIEW STRUCTURE (45 minutes):
1. Introduction & Warm-up (5 minutes)
2. Technical Deep Dive (25 minutes)
3. Problem-Solving Scenarios (10 minutes)
4. Behavioral Questions (3 minutes)
5. Candidate Questions & Wrap-up (2 minutes)

TECHNICAL EVALUATION AREAS:
- Core technical knowledge in ${config.role}
- Problem-solving approach and methodology
- Code quality and best practices
- System design and architecture understanding
- Debugging and troubleshooting skills
- Performance optimization knowledge
- Security awareness
- Testing strategies
- Version control and collaboration
- Industry best practices

BEHAVIORAL EVALUATION AREAS:
- Communication clarity and articulation
- Learning agility and adaptability
- Team collaboration skills
- Problem-solving methodology
- Time management and prioritization
- Leadership potential
- Cultural fit

INTERVIEW GUIDELINES:
1. Start with a warm, professional greeting
2. Ask open-ended questions that require detailed explanations
3. Probe deeper into technical concepts with follow-up questions
4. Present real-world scenarios and ask how they would approach them
5. Evaluate both technical knowledge and communication skills
6. Be encouraging but thorough in your assessment
7. Take notes on strengths and areas for improvement
8. Provide constructive feedback throughout
9. End with candidate questions and next steps

SCORING CRITERIA:
- Technical Knowledge (1-10): Depth and accuracy of technical understanding
- Communication (1-10): Clarity, articulation, and ability to explain complex concepts
- Problem Solving (1-10): Approach, methodology, and logical thinking
- Domain Knowledge (1-10): Understanding of ${config.role} specific concepts
- Overall Performance (1-10): Holistic assessment of interview performance

EVALUATION APPROACH:
- Ask progressively challenging questions
- Evaluate both breadth and depth of knowledge
- Assess practical application of concepts
- Consider learning modules completed
- Look for growth mindset and continuous learning attitude
- Evaluate real-world problem-solving abilities

Remember to be thorough, fair, and constructive in your evaluation. The goal is to assess the candidate's current abilities while identifying areas for growth and development.`;
  }

  /**
   * Start VAPI call for interview
   */
  async startInterviewCall(assistantId: string, phoneNumber: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.VAPI_BASE_URL}/call`,
        {
          assistantId,
          phoneNumber,
          customer: {
            number: phoneNumber
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.VAPI_PRIVATE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('VAPI call started successfully:', response.data.id);
      return response.data.id;
    } catch (error) {
      console.error('Failed to start VAPI call:', error);
      throw error;
    }
  }

  /**
   * Get call status and transcript
   */
  async getCallStatus(callId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.VAPI_BASE_URL}/call/${callId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.VAPI_PRIVATE_KEY}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get call status:', error);
      throw error;
    }
  }

  /**
   * Process interview evaluation results
   */
  async processInterviewResults(transcript: string, evaluationData: any): Promise<VAPIEvaluationResult> {
    try {
      // Parse evaluation data from VAPI function calls
      const evaluations = evaluationData.functionCalls || [];
      
      let overallScore = 0;
      let technicalScore = 0;
      let communicationScore = 0;
      let problemSolvingScore = 0;
      let domainKnowledgeScore = 0;
      const allStrengths: string[] = [];
      const allWeaknesses: string[] = [];
      const allRecommendations: string[] = [];

      // Process individual evaluations
      for (const evaluation of evaluations) {
        if ((evaluation as any).functionName === 'evaluate_response') {
          const params = (evaluation as any).parameters;
          technicalScore += params.technicalAccuracy;
          communicationScore += params.communicationClarity;
          problemSolvingScore += params.problemSolvingApproach;
          overallScore += params.responseQuality;
          
          allStrengths.push(...(params.strengths || []));
          allWeaknesses.push(...(params.weaknesses || []));
        } else if ((evaluation as any).functionName === 'final_evaluation') {
          const params = (evaluation as any).parameters;
          overallScore = params.overallScore;
          technicalScore = params.technicalScore;
          communicationScore = params.communicationScore;
          problemSolvingScore = params.problemSolvingScore;
          domainKnowledgeScore = params.domainKnowledgeScore;
          
          allStrengths.push(...(params.strengths || []));
          allWeaknesses.push(...(params.weaknesses || []));
          allRecommendations.push(...(params.recommendations || []));
        }
      }

      // Calculate average scores
      const evaluationCount = evaluations.filter((e: any) => e.functionName === 'evaluate_response').length;
      if (evaluationCount > 0) {
        technicalScore = Math.round(technicalScore / evaluationCount);
        communicationScore = Math.round(communicationScore / evaluationCount);
        problemSolvingScore = Math.round(problemSolvingScore / evaluationCount);
        overallScore = Math.round(overallScore / evaluationCount);
      }

      return {
        overallScore,
        technicalScore,
        communicationScore,
        problemSolvingScore,
        domainKnowledgeScore,
        strengths: [...new Set(allStrengths)],
        weaknesses: [...new Set(allWeaknesses)],
        recommendations: [...new Set(allRecommendations)],
        detailedFeedback: this.generateDetailedFeedback(overallScore, allStrengths, allWeaknesses, allRecommendations)
      };
    } catch (error) {
      console.error('Error processing interview results:', error);
      throw error;
    }
  }

  /**
   * Generate detailed feedback based on evaluation
   */
  private generateDetailedFeedback(
    overallScore: number, 
    strengths: string[], 
    weaknesses: string[], 
    recommendations: string[]
  ): string {
    let feedback = `## Interview Performance Summary\n\n`;
    
    feedback += `**Overall Score: ${overallScore}/10**\n\n`;
    
    if (overallScore >= 8) {
      feedback += `🎉 **Excellent Performance!** You demonstrated strong technical knowledge and communication skills throughout the interview.\n\n`;
    } else if (overallScore >= 6) {
      feedback += `👍 **Good Performance!** You showed solid understanding with room for improvement in some areas.\n\n`;
    } else if (overallScore >= 4) {
      feedback += `📈 **Developing Performance.** You have a foundation to build upon with focused effort.\n\n`;
    } else {
      feedback += `🎯 **Areas for Growth.** Focus on strengthening core concepts and communication skills.\n\n`;
    }

    if (strengths.length > 0) {
      feedback += `## Key Strengths\n`;
      strengths.forEach((strength, index) => {
        feedback += `${index + 1}. ${strength}\n`;
      });
      feedback += `\n`;
    }

    if (weaknesses.length > 0) {
      feedback += `## Areas for Improvement\n`;
      weaknesses.forEach((weakness, index) => {
        feedback += `${index + 1}. ${weakness}\n`;
      });
      feedback += `\n`;
    }

    if (recommendations.length > 0) {
      feedback += `## Recommendations for Growth\n`;
      recommendations.forEach((recommendation, index) => {
        feedback += `${index + 1}. ${recommendation}\n`;
      });
      feedback += `\n`;
    }

    feedback += `## Next Steps\n`;
    feedback += `1. Review the technical concepts discussed during the interview\n`;
    feedback += `2. Practice explaining complex topics clearly and concisely\n`;
    feedback += `3. Continue building hands-on experience with real-world projects\n`;
    feedback += `4. Consider additional learning resources in identified weak areas\n`;
    feedback += `5. Practice mock interviews to improve confidence and communication\n\n`;
    
    feedback += `Keep learning and growing! Every interview is an opportunity to improve. 🚀`;

    return feedback;
  }

  /**
   * Generate interview questions based on role and learning modules
   */
  generateInterviewQuestions(role: string, learningModules: string[]): string[] {
    const baseQuestions = [
      "Can you walk me through your experience with the learning modules you've completed?",
      "What was the most challenging concept you learned, and how did you overcome it?",
      "How would you explain [core concept] to someone who has no technical background?",
      "Can you describe a time when you had to debug a complex problem? What was your approach?",
      "What are the key differences between [concept A] and [concept B]?",
      "How would you optimize the performance of [system/application]?",
      "What security considerations would you keep in mind when building [application type]?",
      "How do you stay updated with the latest developments in [field]?",
      "Can you walk me through your thought process for solving [technical problem]?",
      "What testing strategies would you implement for [project type]?"
    ];

    // Add role-specific questions
    const roleSpecificQuestions = this.getRoleSpecificQuestions(role);
    const moduleSpecificQuestions = this.getModuleSpecificQuestions(learningModules);

    return [...baseQuestions, ...roleSpecificQuestions, ...moduleSpecificQuestions];
  }

  /**
   * Get role-specific interview questions
   */
  private getRoleSpecificQuestions(role: string): string[] {
    const questionMap: { [key: string]: string[] } = {
      'Software Engineer': [
        "Explain the difference between synchronous and asynchronous programming.",
        "How would you design a scalable web application?",
        "What's your approach to code review and quality assurance?",
        "How do you handle database optimization and query performance?",
        "Explain the principles of clean code and SOLID principles."
      ],
      'Data Analyst': [
        "How would you approach analyzing a large dataset with missing values?",
        "Explain the difference between correlation and causation.",
        "What visualization techniques would you use for different types of data?",
        "How do you ensure data quality and accuracy in your analysis?",
        "Describe your experience with statistical analysis and hypothesis testing."
      ],
      'Data Scientist': [
        "Explain the bias-variance tradeoff in machine learning.",
        "How would you handle overfitting in a machine learning model?",
        "What's your approach to feature engineering and selection?",
        "How do you evaluate the performance of different ML algorithms?",
        "Describe your experience with deep learning and neural networks."
      ],
      'Frontend Developer': [
        "Explain the difference between React and Vue.js.",
        "How do you optimize web performance and loading times?",
        "What's your approach to responsive design and cross-browser compatibility?",
        "How do you handle state management in large applications?",
        "Explain the benefits of component-based architecture."
      ],
      'Backend Developer': [
        "How would you design a RESTful API?",
        "Explain the difference between SQL and NoSQL databases.",
        "How do you handle authentication and authorization?",
        "What's your approach to API versioning and backward compatibility?",
        "How do you ensure data consistency in distributed systems?"
      ]
    };

    return questionMap[role] || [];
  }

  /**
   * Get module-specific interview questions
   */
  private getModuleSpecificQuestions(modules: string[]): string[] {
    const moduleQuestions: { [key: string]: string[] } = {
      'JavaScript': [
        "Explain closures in JavaScript with examples.",
        "What's the difference between let, const, and var?",
        "How do you handle asynchronous operations in JavaScript?"
      ],
      'React': [
        "Explain the React component lifecycle.",
        "What's the difference between props and state?",
        "How do you handle side effects in React components?"
      ],
      'Python': [
        "Explain list comprehensions in Python.",
        "What's the difference between lists and tuples?",
        "How do you handle exceptions in Python?"
      ],
      'SQL': [
        "Explain the difference between INNER JOIN and LEFT JOIN.",
        "How do you optimize slow SQL queries?",
        "What's the purpose of database indexing?"
      ],
      'Machine Learning': [
        "Explain the difference between supervised and unsupervised learning.",
        "How do you handle missing data in machine learning?",
        "What's the purpose of cross-validation?"
      ]
    };

    const questions: string[] = [];
    modules.forEach(module => {
      if (moduleQuestions[module]) {
        questions.push(...moduleQuestions[module]);
      }
    });

    return questions;
  }
}

// Export singleton instance
export const vapiWorkflowService = new VAPIWorkflowService();
