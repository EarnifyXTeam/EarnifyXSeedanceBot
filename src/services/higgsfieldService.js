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
   * Generate video using Seedance 2.5
   * @param {string} prompt - Prompt describing the video
   * @param {string} aspectRatio - "16:9" or "9:16"
   */
  static async generateVideo(prompt, aspectRatio = '16:9') {
    try {
      console.log(`🎬 Submitting Seedance 2.5 Video Generation: "${prompt}" [${aspectRatio}]`);

      const params = {
        model: config.defaultVideoModel,
        prompt: prompt,
        aspect_ratio: aspectRatio,
        use_unlim: true, // Uses Ultra 3K free trial unlimited allowance
      };

      const response = await mcpClient.callTool('generate_video', {
        params,
        context: 'Telegram user video generation request via EarnifyXSeedanceBot',
      });

      console.log('Video generation raw response received');
      return response;
    } catch (error) {
      console.error('Error in generateVideo:', error);
      throw error;
    }
  }

  /**
   * Generate image
   * @param {string} prompt - Prompt describing the image
   * @param {string} aspectRatio - "1:1", "16:9", "9:16"
   */
  static async generateImage(prompt, aspectRatio = '1:1') {
    try {
      console.log(`🖼️ Submitting Image Generation: "${prompt}" [${aspectRatio}]`);

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

      return response;
    } catch (error) {
      console.error('Error in generateImage:', error);
      throw error;
    }
  }

  /**
   * Generate voice / audio
   * @param {string} text - Text for speech generation
   */
  static async generateAudio(text) {
    try {
      console.log(`🎙️ Submitting Voice Generation: "${text}"`);

      const params = {
        prompt: text,
      };

      const response = await mcpClient.callTool('generate_audio', {
        params,
      });

      return response;
    } catch (error) {
      console.error('Error in generateAudio:', error);
      throw error;
    }
  }
}
