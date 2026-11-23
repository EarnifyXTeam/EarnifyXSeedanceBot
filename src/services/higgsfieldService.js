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
      // Regex for media URLs (mp4, webm, jpg, jpeg, png, webp, mp3, wav)
      const mediaRegex = /https?:\/\/[^\s"'<>]+\.(mp4|webm|jpg|jpeg|png|webp|mp3|wav)(\?[^\s"'<>]*)?/gi;
      let match;
      while ((match = mediaRegex.exec(text)) !== null) {
        urls.push(match[0]);
      }
      // General URL regex if no media extension
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
   * Long-poll until job completes and returns video URL
   */
  static async waitForJob(jobId, maxWaitSeconds = 180) {
    const startTime = Date.now();
    console.log(`⏳ Starting polling for Job ID: ${jobId}`);

    while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
      try {
        const response = await mcpClient.callTool('jobs_wait', {
          jobs: [{ index: 0, job_id: jobId }],
          timeout_seconds: 15,
        });

        const urls = this.extractUrls(response);
        const videoUrl = urls.find((u) => u.match(/\.(mp4|webm)(\?.*)?$/i));
        if (videoUrl) {
          console.log(`🎉 Job ${jobId} completed! Video URL: ${videoUrl}`);
          return videoUrl;
        }

        const text = this.getResponseText(response);
        console.log(`[Job ${jobId} status snapshot]:`, text.split('\n')[0] || text.slice(0, 100));

        // Only throw if actual job failed (do NOT match 'failed: 0' in summary)
        if (
          text.includes(',failed,') ||
          text.includes('status: failed') ||
          (text.includes('failed:') && !text.includes('failed: 0'))
        ) {
          throw new Error('Video rendering failed on Higgsfield server.');
        }

        if (text.includes('completed') || text.includes('all_terminal: true')) {
          if (urls.length > 0) return urls[0];
          // Try fetching via job_display if URL wasn't embedded in summary
          try {
            const displayRes = await mcpClient.callTool('job_display', { id: jobId });
            const dispUrls = this.extractUrls(displayRes);
            if (dispUrls.length > 0) return dispUrls[0];
          } catch (e) {
            // ignore
          }
        }

        // Wait 4 seconds between poll cycles
        await new Promise((resolve) => setTimeout(resolve, 4000));
      } catch (err) {
        if (err.message?.includes('failed on Higgsfield')) {
          throw err;
        }
        console.warn(`Polling attempt note for ${jobId}: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.warn(`⚠️ Polling timed out for Job ID: ${jobId}`);
    return null;
  }

  /**
   * Generate video using Seedance 2.5
   * @param {string} prompt - Prompt describing the video
   * @param {string} aspectRatio - "16:9" or "9:16"
   */
  static async generateVideo(prompt, aspectRatio = '9:16') {
    try {
      console.log(`🎬 Submitting Seedance 2.5 Video Generation: "${prompt.slice(0, 80)}..." [${aspectRatio}]`);

      const params = {
        model: config.defaultVideoModel,
        prompt: prompt,
        aspect_ratio: aspectRatio,
        use_unlim: true, // Ultra 3K free trial unlimited allowance
      };

      const response = await mcpClient.callTool('generate_video', {
        params,
        context: 'Telegram user video generation request via EarnifyXSeedanceBot',
      });

      const responseText = this.getResponseText(response);
      console.log('Video generation submission response:', responseText.slice(0, 200));

      // Check if URL is immediately returned
      const immediateUrls = this.extractUrls(response);
      const immediateVideo = immediateUrls.find((u) => u.match(/\.(mp4|webm)(\?.*)?$/i));
      if (immediateVideo) {
        return { videoUrl: immediateVideo, text: responseText };
      }

      // Check for UUID job ID in response text
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = responseText.match(uuidRegex);

      if (match) {
        const jobId = match[0];
        console.log(`📌 Found Job ID: ${jobId}. Now waiting for render to finish...`);
        const polledVideoUrl = await this.waitForJob(jobId);
        return { videoUrl: polledVideoUrl, jobId, text: responseText };
      }

      return { videoUrl: null, text: responseText };
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

      const response = await mcpClient.callTool('generate_image', {
        params,
        context: 'Telegram user image generation request via EarnifyXSeedanceBot',
      });

      const responseText = this.getResponseText(response);
      const immediateUrls = this.extractUrls(response);
      const immediateImage = immediateUrls.find((u) => u.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i));

      if (immediateImage) {
        return { imageUrl: immediateImage, text: responseText };
      }

      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = responseText.match(uuidRegex);
      if (match) {
        const polledUrl = await this.waitForJob(match[0], 60);
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
      const response = await mcpClient.callTool('generate_audio', { params });
      return response;
    } catch (error) {
      console.error('Error in generateAudio:', error);
      throw error;
    }
  }
}
