import { mcpClient } from '../mcpClient.js';
import { config } from '../config.js';

export class HiggsfieldService {
  /**
   * Check account balance and active plan
   */
  static async checkBalance() {
    try {
      const response = await mcpClient.callTool('balance', {});
      return response;
    } catch (error) {
      console.error('Error in checkBalance:', error);
      throw error;
    }
  }

  /**
   * Helper to extract URLs from response
   */
  static extractUrls(response) {
    const urls = [];
    if (!response) return urls;

    const findInText = (text) => {
      if (typeof text !== 'string') return;
      const mediaRegex = /https?:\/\/[^\s"'<>]+\.(mp4|webm|jpg|jpeg|png|webp|mp3|wav)(\?[^\s"'<>]*)?/gi;
      let match;
      while ((match = mediaRegex.exec(text)) !== null) {
        urls.push(match[0]);
      }
      const generalUrlRegex = /https?:\/\/[^\s"'<>]+/gi;
      let genMatch;
      while ((genMatch = generalUrlRegex.exec(text)) !== null) {
        if (!urls.includes(genMatch[0])) {
          urls.push(genMatch[0]);
        }
      }
    };

    if (Array.isArray(response.content)) {
      for (const item of response.content) {
        if (item.text) findInText(item.text);
      }
    } else if (typeof response === 'string') {
      findInText(response);
    }

    return urls;
  }

  /**
   * Helper to format text content from MCP response
   */
  static getResponseText(response) {
    if (!response) return '';
    if (typeof response === 'string') return response;
    if (Array.isArray(response.content)) {
      return response.content
        .map((item) => (typeof item.text === 'string' ? item.text : JSON.stringify(item)))
        .join('\n');
    }
    return JSON.stringify(response);
  }

  /**
   * Directly check show_generations to find completed video URL for a Job ID
   */
  static async getVideoUrlFromGenerations(jobId) {
    try {
      const res = await mcpClient.callTool('show_generations', {}, 30000);
      const text = this.getResponseText(res);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.includes(jobId)) {
          console.log(`[show_generations snapshot]: ${line.trim()}`);
          if (line.includes('completed')) {
            const urlMatch = line.match(/https?:\/\/[^\s"',]+\.(mp4|webm|jpg|png|webp)/i);
            if (urlMatch) {
              return urlMatch[0];
            }
          }
          if (line.includes('failed')) {
            throw new Error('Video generation status: failed on server.');
          }
        }
      }
    } catch (e) {
      if (e.message?.includes('status: failed')) throw e;
    }
    return null;
  }

  /**
   * Fast snapshot polling until job completes and returns video URL
   */
  static async waitForJob(jobId, maxWaitSeconds = 480) {
    const startTime = Date.now();
    console.log(`⏳ Monitoring Job ID: ${jobId} (Timeout budget: ${maxWaitSeconds}s)...`);

    while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
      try {
        // Fast Check: show_generations (direct CloudFront CDN URL)
        const directUrl = await this.getVideoUrlFromGenerations(jobId);
        if (directUrl) {
          console.log(`🎉 Job ${jobId} COMPLETED! CDN URL: ${directUrl}`);
          return directUrl;
        }

        // Wait 8 seconds before next check to give Higgsfield GPU time
        await new Promise((resolve) => setTimeout(resolve, 8000));
      } catch (err) {
        if (err.message?.includes('failed on Higgsfield') || err.message?.includes('status: failed')) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    }

    // Final check on show_generations right before timing out
    const finalCheckUrl = await this.getVideoUrlFromGenerations(jobId);
    if (finalCheckUrl) return finalCheckUrl;

    console.warn(`⚠️ Polling timed out after ${maxWaitSeconds}s for Job ID: ${jobId}`);
    return null;
  }

  /**
   * Generate video using Seedance 2.5 with Dynamic Duration (up to 30s)
   */
  static async generateVideo(prompt, aspectRatio = '9:16', customDuration = null) {
    try {
      let duration = customDuration;
      if (!duration) {
        const durationMatch = prompt.match(/\b([4-9]|[12][0-9]|30)[\s\-_]*(seconds?|secs?|s)\b/i);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        } else if (/\b30[\s\-_]*(second|sec|s)\b/i.test(prompt) || prompt.includes('30-second') || prompt.includes('30s') || prompt.includes('30 second')) {
          duration = 30;
        } else {
          duration = 5;
        }
      }

      duration = Math.max(4, Math.min(30, duration));

      console.log(`🎬 Submitting Seedance 2.5 Video Generation: "${prompt.slice(0, 70)}..." [${aspectRatio}] [${duration}s]`);

      const params = {
        model: config.defaultVideoModel,
        prompt: prompt,
        aspect_ratio: aspectRatio,
        duration: duration,
        generate_audio: true,
        use_unlim: true,
      };

      const response = await mcpClient.callTool(
        'generate_video',
        {
          params,
          context: 'Telegram user video generation request via EarnifyXSeedanceBot',
        },
        180000
      );

      const responseText = this.getResponseText(response);
      console.log('Video generation submission response:', responseText.slice(0, 200));

      const immediateUrls = this.extractUrls(response);
      const immediateVideo = immediateUrls.find((u) => u.match(/\.(mp4|webm)(\?.*)?$/i));
      if (immediateVideo) {
        return { videoUrl: immediateVideo, text: responseText, duration };
      }

      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = responseText.match(uuidRegex);

      if (match) {
        const jobId = match[0];
        console.log(`📌 Found Job ID: ${jobId}. Now waiting for render to finish...`);
        const timeoutSeconds = duration > 10 ? 480 : 240;
        const polledVideoUrl = await this.waitForJob(jobId, timeoutSeconds);
        return { videoUrl: polledVideoUrl, jobId, text: responseText, duration };
      }

      return { videoUrl: null, text: responseText, duration };
    } catch (error) {
      console.error('Error in generateVideo:', error);
      throw error;
    }
  }

  /**
   * Generate image
   */
  static async generateImage(prompt, aspectRatio = '1:1') {
    try {
      console.log(`🖼️ Submitting Image Generation: "${prompt.slice(0, 80)}..." [${aspectRatio}]`);

      const params = {
        model: 'gpt_image_2_6',
        prompt: prompt,
        aspect_ratio: aspectRatio,
        use_unlim: true,
      };

      const response = await mcpClient.callTool(
        'generate_image',
        {
          params,
          context: 'Telegram user image generation request via EarnifyXSeedanceBot',
        },
        120000
      );

      const responseText = this.getResponseText(response);
      const immediateUrls = this.extractUrls(response);
      const immediateImage = immediateUrls.find((u) => u.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i));

      if (immediateImage) {
        return { imageUrl: immediateImage, text: responseText };
      }

      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = responseText.match(uuidRegex);
      if (match) {
        const polledUrl = await this.waitForJob(match[0], 90);
        return { imageUrl: polledUrl, text: responseText };
      }

      return { imageUrl: immediateUrls[0] || null, text: responseText };
    } catch (error) {
      console.error('Error in generateImage:', error);
      throw error;
    }
  }

  /**
   * Generate voice / audio
   */
  static async generateAudio(text) {
    try {
      console.log(`🎙️ Submitting Voice Generation: "${text.slice(0, 80)}..."`);
      const params = { prompt: text };
      const response = await mcpClient.callTool('generate_audio', { params }, 120000);
      return response;
    } catch (error) {
      console.error('Error in generateAudio:', error);
      throw error;
    }
  }
}
