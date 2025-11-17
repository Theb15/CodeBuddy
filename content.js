// Content script for Code Buddy
class CodeBuddy {
  constructor() {
    this.bubble = null;
    this.overlay = null;
    this.extractedCode = '';
    this.currentLanguage = '';
    this.init();
  }

  init() {
    this.createBubble();
    this.setupEventListeners();
  }

  createBubble() {
    // Create floating bubble
    this.bubble = document.createElement('div');
    this.bubble.id = 'code-buddy-bubble';
    this.bubble.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="white"/>
      </svg>
    `;
    this.bubble.title = 'Code Buddy - AI Assistant';
    document.body.appendChild(this.bubble);
  }

  setupEventListeners() {
    this.bubble.addEventListener('click', () => {
      this.extractCode();
      this.showOptions();
    });
  }

  extractCode() {
    // Try different selectors for various platforms
    const selectors = [
      '.monaco-editor .view-lines', // LeetCode, VS Code editor
      '.CodeMirror-code', // CodeMirror editors
      'textarea[name="code"]',
      'textarea.form-control',
      '#editor',
      '.ace_content', // Ace editor
      'pre code', // Generic code blocks
      '.code-editor',
      '[class*="editor"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element.tagName === 'TEXTAREA') {
          this.extractedCode = element.value;
        } else if (element.classList.contains('CodeMirror-code')) {
          this.extractedCode = this.extractFromCodeMirror(element);
        } else if (element.classList.contains('view-lines')) {
          this.extractedCode = this.extractFromMonaco(element);
        } else {
          this.extractedCode = element.innerText || element.textContent;
        }

        if (this.extractedCode.trim()) {
          this.detectLanguage();
          break;
        }
      }
    }

    if (!this.extractedCode.trim()) {
      this.extractedCode = prompt('Paste your code here:') || '';
    }
  }

  extractFromCodeMirror(element) {
    const lines = element.querySelectorAll('.CodeMirror-line');
    return Array.from(lines).map(line => line.textContent).join('\n');
  }

  extractFromMonaco(element) {
    const lines = element.querySelectorAll('.view-line');
    return Array.from(lines).map(line => line.textContent).join('\n');
  }

  detectLanguage() {
    // Simple language detection based on syntax
    const code = this.extractedCode.toLowerCase();
    
    if (code.includes('def ') || code.includes('import ') && code.includes(':')) {
      this.currentLanguage = 'Python';
    } else if (code.includes('function') || code.includes('const ') || code.includes('let ')) {
      this.currentLanguage = 'JavaScript';
    } else if (code.includes('public class') || code.includes('System.out')) {
      this.currentLanguage = 'Java';
    } else if (code.includes('#include') || code.includes('cout')) {
      this.currentLanguage = 'C++';
    } else if (code.includes('func ') && code.includes('package main')) {
      this.currentLanguage = 'Go';
    } else {
      this.currentLanguage = 'Unknown';
    }
  }

  showOptions() {
    if (this.overlay) {
      this.overlay.remove();
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'code-buddy-overlay';
    this.overlay.innerHTML = `
      <div class="code-buddy-header">
        <h3>🤖 Code Buddy</h3>
        <button class="close-btn" id="close-overlay">&times;</button>
      </div>
      <div class="code-buddy-info">
        <p><strong>Detected Language:</strong> ${this.currentLanguage}</p>
        <p><strong>Code Lines:</strong> ${this.extractedCode.split('\n').length}</p>
      </div>
      <div class="code-buddy-options">
        <button class="option-btn" data-action="errors">
          <span class="icon">🐛</span>
          <span class="label">Find Errors</span>
        </button>
        <button class="option-btn" data-action="logic">
          <span class="icon">🧠</span>
          <span class="label">Logic Guidance</span>
        </button>
        <button class="option-btn" data-action="optimize">
          <span class="icon">⚡</span>
          <span class="label">Optimize Code</span>
        </button>
        <button class="option-btn" data-action="rate">
          <span class="icon">⭐</span>
          <span class="label">Rate My Code</span>
        </button>
      </div>
      <div class="code-buddy-result" id="result-container" style="display: none;">
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <p>Analyzing your code...</p>
        </div>
        <div class="result-content" id="result-content"></div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Event listeners
    document.getElementById('close-overlay').addEventListener('click', () => {
      this.overlay.remove();
    });

    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleAction(action);
      });
    });
  }

  async handleAction(action) {
    const resultContainer = document.getElementById('result-container');
    const resultContent = document.getElementById('result-content');
    const loading = document.getElementById('loading');

    resultContainer.style.display = 'block';
    loading.style.display = 'block';
    resultContent.style.display = 'none';

    try {
      const prompt = this.buildPrompt(action);
      const response = await this.callLLM(prompt, action);
      
      loading.style.display = 'none';
      resultContent.style.display = 'block';
      
      if (action === 'logic') {
        // Handle MCQ for logic guidance
        this.handleLogicMCQ(response, resultContent);
      } else {
        resultContent.innerHTML = this.formatResponse(response, action);
      }
    } catch (error) {
      loading.style.display = 'none';
      resultContent.style.display = 'block';
      resultContent.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
    }
  }

  handleLogicMCQ(response, container) {
    try {
      // Extract JSON from response
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      this.mcqData = {
        questions: data.questions,
        currentIndex: 0,
        answers: [],
        correctCount: 0
      };
      
      this.renderMCQ(container);
    } catch (error) {
      console.error('MCQ parsing error:', error);
      container.innerHTML = `<div class="error">❌ Could not parse questions. ${error.message}</div>`;
    }
  }

  renderMCQ(container) {
    const { questions, currentIndex, correctCount } = this.mcqData;
    const question = questions[currentIndex];
    
    if (!question) {
      // Show summary
      this.renderMCQSummary(container);
      return;
    }

    container.innerHTML = `
      <div class="mcq-container">
        <div class="mcq-question">
          <div class="mcq-header">
            <span class="mcq-number">Question ${currentIndex + 1}</span>
            <span class="mcq-progress">${currentIndex + 1} of ${questions.length}</span>
          </div>
          <div class="mcq-text">${question.question}</div>
          <div class="mcq-options" id="mcq-options">
            ${question.options.map((opt, i) => `
              <div class="mcq-option" data-option="${String.fromCharCode(65 + i)}">
                <div class="mcq-option-letter">${String.fromCharCode(65 + i)}</div>
                <div class="mcq-option-text">${opt.replace(/^[A-D]\)\s*/, '')}</div>
              </div>
            `).join('')}
          </div>
          <div class="mcq-feedback" id="mcq-feedback"></div>
          <div class="mcq-actions">
            <button class="mcq-btn primary" id="mcq-submit" disabled>Submit Answer</button>
            <button class="mcq-btn secondary" id="mcq-next" style="display: none;">Next Question →</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    let selectedOption = null;
    document.querySelectorAll('.mcq-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedOption = opt.dataset.option;
        document.getElementById('mcq-submit').disabled = false;
      });
    });

    document.getElementById('mcq-submit').addEventListener('click', () => {
      this.submitMCQAnswer(selectedOption, question);
    });

    document.getElementById('mcq-next').addEventListener('click', () => {
      this.mcqData.currentIndex++;
      this.renderMCQ(container);
    });
  }

  submitMCQAnswer(selected, question) {
    const isCorrect = selected === question.correct;
    const feedback = document.getElementById('mcq-feedback');
    const selectedOpt = document.querySelector(`[data-option="${selected}"]`);
    const correctOpt = document.querySelector(`[data-option="${question.correct}"]`);

    if (isCorrect) {
      this.mcqData.correctCount++;
      selectedOpt.classList.add('correct');
      feedback.className = 'mcq-feedback correct show';
      feedback.innerHTML = `✅ Correct! ${question.explanation}`;
    } else {
      selectedOpt.classList.add('incorrect');
      correctOpt.classList.add('correct');
      feedback.className = 'mcq-feedback incorrect show';
      feedback.innerHTML = `❌ Not quite. The correct answer is ${question.correct}. ${question.explanation}`;
    }

    this.mcqData.answers.push({ question: question.question, selected, correct: question.correct, isCorrect });

    document.getElementById('mcq-submit').style.display = 'none';
    document.getElementById('mcq-next').style.display = 'block';
    document.querySelectorAll('.mcq-option').forEach(opt => {
      opt.style.pointerEvents = 'none';
    });
  }

  renderMCQSummary(container) {
    const { questions, correctCount, answers } = this.mcqData;
    const percentage = Math.round((correctCount / questions.length) * 100);
    
    let feedback = '';
    if (percentage >= 80) {
      feedback = 'Excellent! You have a strong grasp of the logic. Ready to code!';
    } else if (percentage >= 60) {
      feedback = 'Good progress! Consider reviewing the areas you missed.';
    } else {
      feedback = 'You might benefit from more guidance on the logical concepts.';
    }

    container.innerHTML = `
      <div class="mcq-summary">
        <h2>🎯 Quiz Complete!</h2>
        <div class="summary-score">${correctCount}/${questions.length}</div>
        <div class="summary-text">${feedback}</div>
        <div class="summary-actions">
          <button class="mcq-btn primary" id="more-questions">📚 Get 5 More Questions</button>
          <button class="mcq-btn secondary" id="start-coding">💻 Start Coding</button>
        </div>
      </div>
    `;

    document.getElementById('more-questions').addEventListener('click', async () => {
      container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Generating more questions...</p></div>';
      try {
        const prompt = this.buildPrompt('logic');
        const response = await this.callLLM(prompt, 'logic');
        this.handleLogicMCQ(response, container);
      } catch (error) {
        container.innerHTML = `<div class="error">❌ Error: ${error.message}</div>`;
      }
    });

    document.getElementById('start-coding').addEventListener('click', () => {
      this.overlay.remove();
    });
  }

  buildPrompt(action) {
    const prompts = {
      errors: {
        system: "You are an expert code reviewer. Format your response with clear sections using markdown.",
        user: `Analyze this ${this.currentLanguage} code and identify errors:\n\n${this.extractedCode}\n\nFormat your response as:\n## Errors Found\n- List each error with line number\n- Explain why it's an error\n- Suggest how to fix it\n\nUse clear headings and bullet points.`
      },
      logic: {
        system: "You are a Socratic coding mentor who creates multiple choice questions to guide learning.",
        user: `Create exactly 5 MCQ questions about this ${this.currentLanguage} code to help identify logical issues:\n\n${this.extractedCode}\n\nFormat EXACTLY as JSON:\n{\n  "questions": [\n    {\n      "question": "What does this code do in the first iteration?",\n      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n      "correct": "A",\n      "explanation": "Detailed explanation why A is correct"\n    }\n  ]\n}\n\nMake questions progressively reveal the logic issue. Return ONLY valid JSON.`
      },
      optimize: {
        system: "You are a performance optimization expert. Format responses with clear sections.",
        user: `Analyze this ${this.currentLanguage} code:\n\n${this.extractedCode}\n\nFormat as:\n## Current Complexity\n- Time: O(...)\n- Space: O(...)\n\n## Optimization Strategies\n1. Strategy name\n   - How it helps\n   - When to use\n\n## Best Practices\n- List recommendations\n\nUse markdown formatting.`
      },
      rate: {
        system: "You are a code quality assessor. Provide structured scoring.",
        user: `Rate this ${this.currentLanguage} code:\n\n${this.extractedCode}\n\nFormat as:\n## Overall Score: X/100\n\n## Breakdown\n### Correctness (X/25)\n- Detailed feedback\n\n### Code Quality (X/25)\n- Detailed feedback\n\n### Efficiency (X/25)\n- Detailed feedback\n\n### Maintainability (X/25)\n- Detailed feedback\n\n## Key Improvements\n- List top 3 improvements\n\nUse markdown.`
      }
    };

    return prompts[action];
  }

  async callLLM(prompt, action) {
    // Get API keys from storage
    const { apiProvider = 'groq', groqKey, geminiKey } = await chrome.storage.sync.get(['apiProvider', 'groqKey', 'geminiKey']);

    if (apiProvider === 'groq' && groqKey) {
      return await this.callGroq(prompt, groqKey);
    } else if (geminiKey) {
      return await this.callGemini(prompt, geminiKey);
    } else {
      throw new Error('No API key configured. Please set up your API key in the extension popup.');
    }
  }

  async callGroq(prompt, apiKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Groq API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async callGemini(prompt, apiKey) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${prompt.system}\n\n${prompt.user}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  formatResponse(response, action) {
    // Convert markdown to HTML
    let formatted = response
      // Headers
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div class="code-block"><button class="copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.querySelector('code').textContent); this.textContent='✅ Copied!'">📋 Copy</button><pre><code>${this.escapeHtml(code.trim())}</code></pre></div>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Lists - unordered
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Lists - ordered
      .replace(/^\d+\.\s(.*$)/gm, '<li>$1</li>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>');

    // Wrap in paragraph if not already wrapped
    if (!formatted.startsWith('<')) {
      formatted = `<p>${formatted}</p>`;
    }

    // Special formatting for ratings
    if (action === 'rate') {
      formatted = this.enhanceRatingDisplay(formatted);
    }

    // Special formatting for errors
    if (action === 'errors') {
      formatted = this.enhanceErrorDisplay(formatted);
    }

    // Special formatting for optimization
    if (action === 'optimize') {
      formatted = this.enhanceOptimizationDisplay(formatted);
    }

    return formatted;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  enhanceRatingDisplay(html) {
    // Extract overall score
    const scoreMatch = html.match(/Overall Score:\s*(\d+)\/100/i);
    if (scoreMatch) {
      const score = scoreMatch[1];
      let color = '#dc3545';
      if (score >= 80) color = '#28a745';
      else if (score >= 60) color = '#ffc107';
      
      html = html.replace(/Overall Score:\s*\d+\/100/i, `
        <div class="score-card">
          <div class="label">Overall Score</div>
          <div class="score">${score}/100</div>
        </div>
      `);
    }

    // Extract individual metrics
    const metrics = [
      { name: 'Correctness', pattern: /Correctness.*?(\d+)\/25/i },
      { name: 'Code Quality', pattern: /Code Quality.*?(\d+)\/25/i },
      { name: 'Efficiency', pattern: /Efficiency.*?(\d+)\/25/i },
      { name: 'Maintainability', pattern: /Maintainability.*?(\d+)\/25/i }
    ];

    let metricsHtml = '<div class="metric-grid">';
    metrics.forEach(metric => {
      const match = html.match(metric.pattern);
      if (match) {
        metricsHtml += `
          <div class="metric-item">
            <div class="metric-label">${metric.name}</div>
            <div class="metric-value">${match[1]}/25</div>
          </div>
        `;
      }
    });
    metricsHtml += '</div>';

    html = html.replace(/<h3>Breakdown<\/h3>/, `<h3>Breakdown</h3>${metricsHtml}`);

    return html;
  }

  enhanceErrorDisplay(html) {
    // Wrap error items in styled cards
    html = html.replace(/<li>(.*?)<\/li>/gs, (match, content) => {
      let type = 'warning';
      if (content.toLowerCase().includes('critical') || content.toLowerCase().includes('error')) {
        type = 'error';
      }
      return `<div class="issue-card ${type}"><div class="issue-title">⚠️ Issue Found</div><div>${content}</div></div>`;
    });

    return html;
  }

  enhanceOptimizationDisplay(html) {
    // Wrap optimization tips in styled cards
    html = html.replace(/(<h4>.*?<\/h4>[\s\S]*?(?=<h[234]|$))/g, (match) => {
      if (match.toLowerCase().includes('strategy') || match.toLowerCase().includes('practice')) {
        return `<div class="optimization-tip"><div class="tip-title">💡 Optimization Tip</div>${match}</div>`;
      }
      return match;
    });

    return html;
  }
}

// Initialize Code Buddy when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CodeBuddy();
  });
} else {
  new CodeBuddy();
}